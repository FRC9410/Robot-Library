"""Run the NT4 MCP server with a lossless, incremental read tool for Power Tool."""

import base64
import json
import math
from threading import Lock

import ntcore
from fastmcp.tools import ToolResult
from mcp_wpilib_nt4.app import LOCAL_STATE, tool_errors
from mcp_wpilib_nt4.errors import NT4Error
from mcp_wpilib_nt4.server import mcp
from mcp_wpilib_nt4.session import session


def wire_value(value):
    if isinstance(value, bytes):
        return {"base64": base64.b64encode(value).decode("ascii")}
    if isinstance(value, float) and not math.isfinite(value):
        if math.isnan(value):
            return {"number": "NaN"}
        return {"number": "Infinity" if value > 0 else "-Infinity"}
    if isinstance(value, (list, tuple)):
        return [wire_value(item) for item in value]
    return value


class DashboardSubscription:
    def __init__(self, instance, prefixes, period_ms):
        self.instance = instance
        self.prefixes = prefixes
        self.pending = {}
        self.lock = Lock()
        self.subscriber = ntcore.MultiSubscriber(
            instance, prefixes, ntcore.PubSubOptions(periodic=period_ms / 1000)
        )
        self.listener = instance.addListener(
            self.subscriber, ntcore.EventFlags.kValueAll | ntcore.EventFlags.kImmediate, self.receive
        )

    def receive(self, event):
        data = event.data
        name = data.topic.getName()
        type_str = data.topic.getTypeString()
        if type_str:
            snapshot = {
                "name": name,
                "type": type_str,
                "lastChangedTime": data.value.server_time(),
                "value": data.value.value(),
            }
            with self.lock:
                self.pending[name] = snapshot

    def drain(self):
        with self.lock:
            pending, self.pending = self.pending, {}
        return pending

    def close(self):
        self.instance.removeListener(self.listener)
        self.subscriber = None


subscriptions = {}


def clear_subscriptions():
    for subscription in subscriptions.values():
        subscription.close()
    subscriptions.clear()


@mcp.tool(annotations=LOCAL_STATE, output_schema=None)
@tool_errors
async def powerlib_dashboard_updates(host: str | None, port: int, watches: dict[int, list[str]]) -> ToolResult:
    """Configure Power Tool's read subscriptions and return the latest changes since the last poll."""
    if host is None or (host, port) != (session.host, session.port):
        clear_subscriptions()
        if host is None:
            await session.disconnect_safely()
    if host is None:
        return ToolResult(content="[]")
    if (host, port) != (session.host, session.port) or (not session.connected and not subscriptions):
        try:
            await session.connect(host, port, "Power Tool MCP", timeout_s=2.0)
        except NT4Error:
            # The robot or sim is often started after Power Tool. Back off and try again.
            return ToolResult(content="null")

    # NTCore reconnects automatically. Keep existing subscriptions during a robot reboot.
    async with session.operation(require_connection=False):
        if not session.connected:
            for subscription in subscriptions.values():
                subscription.drain()
            return ToolResult(content="[]")
        for period in list(subscriptions):
            if period not in watches or subscriptions[period].prefixes != watches[period]:
                subscriptions.pop(period).close()
        for period, prefixes in watches.items():
            if period not in subscriptions:
                subscriptions[period] = DashboardSubscription(session.inst, prefixes, period)
        updates = {}
        for subscription in subscriptions.values():
            for name, snapshot in subscription.drain().items():
                if name not in updates or snapshot["lastChangedTime"] >= updates[name]["lastChangedTime"]:
                    updates[name] = snapshot

    for snapshot in updates.values():
        snapshot["value"] = wire_value(snapshot["value"])
    return ToolResult(content=json.dumps(list(updates.values()), ensure_ascii=True, allow_nan=False))


if __name__ == "__main__":
    mcp.run(show_banner=False)
