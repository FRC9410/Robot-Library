"""Power Tool's private dashboard adapter for the pinned WPILib MCP server."""

import asyncio
import base64
import math
from typing import Any

import ntcore
from fastmcp.tools import ToolResult
from mcp_wpilib_nt4 import config
from mcp_wpilib_nt4.cli import main
from mcp_wpilib_nt4.errors import NT4Error
from mcp_wpilib_nt4.server import mcp
from mcp_wpilib_nt4.session import session

LEASE_SECONDS = 1.5
VALUE_EVENTS = ntcore.EventFlags.kValueAll | ntcore.EventFlags.kImmediate
SETTERS = {"boolean": "setBoolean", "double": "setDouble", "int": "setInteger", "string": "setString"}


def same_target(host: str, port: int, other_host: str, other_port: int) -> bool:
    def canonical(name: str) -> str:
        name = name.lower().rstrip(".")
        return "127.0.0.1" if name == "localhost" else name

    return port == other_port and canonical(host) == canonical(other_host)


def json_value(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (list, tuple)):
        return [json_value(item) for item in value]
    return value


class Dashboard:
    def __init__(self, owner: str) -> None:
        self.owner = owner
        self.instance = session.inst
        self.poller = ntcore.NetworkTableListenerPoller(self.instance)
        self.subscriptions: dict[tuple[str, int], tuple[ntcore.MultiSubscriber, int]] = {}
        self.publishers: dict[str, tuple[str, ntcore.GenericPublisher]] = {}
        self.lease = None

    def renew(self) -> None:
        if self.lease is not None:
            self.lease.cancel()
        self.lease = asyncio.get_running_loop().call_later(LEASE_SECONDS, release, self.owner)
        session.note_activity()

    def close(self) -> None:
        if self.lease is not None:
            self.lease.cancel()
        self.poller.close()
        for sub, _ in self.subscriptions.values():
            sub.close()
        self.subscriptions.clear()
        self.publishers.clear()

    def read(self, scopes: list[dict], include_names: bool) -> dict:
        wanted = {(item["prefix"], item["intervalMs"]) for item in scopes}
        for key in self.subscriptions.keys() - wanted:
            sub, listener = self.subscriptions.pop(key)
            self.poller.removeListener(listener)
            sub.close()
        for prefix, interval in sorted(wanted - self.subscriptions.keys()):
            sub = ntcore.MultiSubscriber(self.instance, [prefix], ntcore.PubSubOptions(periodic=interval / 1000, keepDuplicates=True))
            self.subscriptions[(prefix, interval)] = (sub, self.poller.addListener(sub, VALUE_EVENTS))

        active = {listener for _, listener in self.subscriptions.values()}
        latest = {}
        for event in self.poller.readQueue():
            if event.listener in active and event.is_(ntcore.EventFlags.kValueAll):
                data = event.data
                latest[data.topic.getName()] = data
        updates = []
        for name, data in latest.items():
            kind = data.topic.getTypeString()
            if not kind:
                continue
            value = data.value.value()
            payload = {"raw": base64.b64encode(value).decode("ascii")} if isinstance(value, (bytes, bytearray, memoryview)) else {"value": json_value(value)}
            updates.append({"name": name, "type": kind, "lastChangedTime": data.value.server_time(), **payload})
        result = {"ready": True, "updates": updates}
        if include_names:
            result["topicNames"] = [info.name for info in self.instance.getTopicInfo()]
        return result

    def publish(self, name: str, kind: str, value: Any) -> None:
        topic = self.instance.getTopic(name)
        existing = topic.getTypeString()
        if existing and existing != kind:
            raise ValueError(f"{name} is published as {existing}, not {kind}.")
        record = self.publishers.get(name)
        if record is None or record[0] != kind:
            self.publishers[name] = (kind, topic.genericPublish(kind))
        publisher = self.publishers[name][1]
        if not getattr(publisher, SETTERS[kind])(value):
            raise ValueError(f"NetworkTables rejected the value for {name}.")
        self.instance.flush()


dashboard: Dashboard | None = None
connecting: asyncio.Task | None = None
retry_at = 0.0


def release(owner: str) -> None:
    global dashboard
    if dashboard is not None and dashboard.owner == owner:
        current, dashboard = dashboard, None
        current.close()


async def connect(host: str, port: int) -> None:
    try:
        await session.connect(host, port, config.default_identity(), timeout_s=2.0)
    except NT4Error:
        pass  # Power Tool keeps its direct client until the configured endpoint answers.


def probe(host: str, port: int) -> bool:
    global connecting, retry_at
    if connecting is not None and not connecting.done():
        return False
    if session.connected:
        return same_target(host, port, session.host, session.port)
    try:
        session.inst
        return False  # ntcore already has a client and manages its reconnects.
    except NT4Error:
        pass
    configured = config.default_host()
    if configured and not same_target(host, port, configured, config.default_port()):
        return False
    now = asyncio.get_running_loop().time()
    if now >= retry_at:
        retry_at = now + 2
        connecting = asyncio.create_task(connect(configured or host, port))
    return False


def exchange(request: dict[str, Any]) -> dict:
    global dashboard
    action = request["action"]
    if action == "probe":
        return {"ready": probe(request["host"], request["port"])}
    owner = request["owner"]
    if action == "release":
        release(owner)
        return {"ready": False}
    if action == "attach":
        if not probe(request["host"], request["port"]):
            return {"ready": False}
        if dashboard is not None:
            release(dashboard.owner)
        dashboard = Dashboard(owner)
        dashboard.renew()
        return {"ready": True}
    if dashboard is None or dashboard.owner != owner:
        return {"ready": False}
    if not session.connected or dashboard.instance is not session.inst:
        release(owner)
        return {"ready": False}
    if action == "heartbeat":
        dashboard.renew()
    elif action == "read":
        return dashboard.read(request["scopes"], request["topicNames"])
    elif action == "publish":
        dashboard.publish(request["name"], request["type"], request["value"])
    return {"ready": True}


@mcp.tool(name="_power_tool_nt4", output_schema=None)
async def dashboard_exchange(request: dict[str, Any]) -> ToolResult:
    return ToolResult(content=[], structured_content=exchange(request))


if __name__ == "__main__":
    main()
