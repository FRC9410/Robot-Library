const cameraKeys = new Set(["tv", "tx", "ty", "ta", "getpipe", "pipeline", "botpose", "json"]);

/** Find custom-named Limelights from topic metadata without subscribing to all values. */
export class CameraTopicDiscovery {
  private readonly keys = new Map<string, Set<string>>();
  private readonly watched = new Set<string>();

  observe(name: string) {
    const [, table, key] = name.split("/");
    if (!table || !key || table.startsWith("limelight") || this.watched.has(table) || !cameraKeys.has(key)) return;
    const known = this.keys.get(table) ?? new Set<string>();
    known.add(key);
    this.keys.set(table, known);
    if (known.size < 3) return;
    this.watched.add(table);
    this.keys.delete(table);
    return `/${table}/`;
  }
}
