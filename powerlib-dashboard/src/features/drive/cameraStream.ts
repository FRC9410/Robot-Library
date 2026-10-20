const connectionTimeoutMs = 4000;
const retryDelayMs = 4000;

/** One connection per visible camera, shared by its thumbnail and selected view. */
export function startCameraStream(
  container: HTMLElement,
  urls: string[],
  onImage: (image?: HTMLImageElement) => void,
  onFailed: (failed: boolean) => void
) {
  let stopped = false;
  let disconnect = () => {};
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  function connect(index: number) {
    disconnect();
    if (stopped || !urls.length) return;
    const image = document.createElement("img");
    image.alt = "";
    let failed = false;
    let ready = false;
    let frameTimer: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    const clearTimers = () => { clearInterval(frameTimer); clearTimeout(timeout); };
    const markReady = () => {
      if (ready || failed || stopped) return;
      ready = true;
      clearTimers();
      onFailed(false);
    };
    const fail = () => {
      if (failed || stopped) return;
      failed = true;
      onFailed(true);
      if (index + 1 < urls.length) connect(index + 1);
      else {
        disconnect();
        retryTimer = setTimeout(() => connect(0), retryDelayMs);
      }
    };
    disconnect = () => {
      clearTimers();
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      image.remove();
      onImage(undefined);
    };
    image.onload = markReady;
    image.onerror = fail;
    // MJPEG responses can stay open indefinitely. Detect the first decoded frame
    // instead of requiring an onload event before considering the stream healthy.
    frameTimer = setInterval(() => { if (image.naturalWidth > 0) markReady(); }, 100);
    timeout = setTimeout(fail, connectionTimeoutMs);
    container.append(image);
    onImage(image);
    image.src = urls[index];
  }

  onFailed(false);
  connect(0);
  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    disconnect();
  };
}
