"use client";

import { useState, useRef, useEffect } from "react";
import mermaid from "mermaid";

export default function TestMermaidPage() {
  const [code, setCode] = useState("sequenceDiagram\\n  Client->>Server: Request\\n  Server-->>Client: Response");
  const [svgOutput, setSvgOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'default' });
  }, []);

  async function handleRender() {
    setRendering(true);
    setError(null);
    setSvgOutput(null);
    try {
      // mermaid.render needs a unique id for the container
      const id = "mermaid-test-" + Date.now();
      const { svg } = await mermaid.render(id, code);
      setSvgOutput(svg);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Mermaid SVG Rendering Test</h1>
      
      <div>
        <label className="block text-sm font-medium mb-2">Mermaid Code</label>
        <textarea
          className="w-full h-32 p-3 border rounded-lg font-mono text-sm dark:bg-zinc-900"
          value={code}
          onChange={e => setCode(e.target.value)}
        />
      </div>

      <button
        onClick={handleRender}
        disabled={rendering}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium"
      >
        {rendering ? "Rendering..." : "Render SVG"}
      </button>

      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 rounded-lg border border-red-500/20">
          <pre className="text-xs whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {svgOutput && (
        <div className="border rounded-lg p-6 bg-white dark:bg-zinc-900 overflow-x-auto">
          <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Output SVG</h2>
          <div dangerouslySetInnerHTML={{ __html: svgOutput }} />
          
          <h2 className="text-sm font-semibold mt-8 mb-4 text-muted-foreground uppercase tracking-wider">Raw SVG String ({Math.round(svgOutput.length / 1024)} KB)</h2>
          <pre className="text-xs text-muted-foreground overflow-x-auto bg-black/5 p-4 rounded-lg">{svgOutput}</pre>
        </div>
      )}
    </div>
  );
}
