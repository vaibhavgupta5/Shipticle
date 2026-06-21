"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { PromptTemplate } from "@/lib/types";

export default function SettingsPage() {
  // Prompt Template State
  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [promptMsg, setPromptMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // API Keys State
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysMsg, setKeysMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [status, setStatus] = useState({
    GEMINI_API_KEY: false,
    DEVTO_API_KEY: false,
    HASHNODE_API_TOKEN: false,
    HASHNODE_PUBLICATION_ID: false,
    RAPIDAPI_KEY: false,
    MEDIUM_USER_ID: false,
  });

  const [inputs, setInputs] = useState({
    GEMINI_API_KEY: "",
    DEVTO_API_KEY: "",
    HASHNODE_API_TOKEN: "",
    HASHNODE_PUBLICATION_ID: "",
    RAPIDAPI_KEY: "",
    MEDIUM_USER_ID: "",
  });

  // Load Prompt Template
  useEffect(() => {
    const unsubAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setLoadingPrompt(false);
        return;
      }

      const q = query(
        collection(db, "promptTemplates"),
        where("userId", "==", user.uid),
        where("type", "==", "article_generation")
      );

      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const doc = snap.docs[0];
          const data = doc.data() as PromptTemplate;
          setTemplate({ ...data, id: doc.id });
          setSystemPrompt(data.systemPrompt);
        } else {
          setSystemPrompt(defaultPrompt);
        }
        setLoadingPrompt(false);
      });

      return () => unsub();
    });

    return () => unsubAuth();
  }, [defaultPrompt]);

  // Sync systemPrompt with defaultPrompt if no custom template is set
  useEffect(() => {
    if (defaultPrompt && !template) {
      setSystemPrompt(defaultPrompt);
    }
  }, [defaultPrompt, template]);

  // Load API Keys Status
  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      // wait for auth
      await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged(user => {
          if (user) resolve(user);
        });
        setTimeout(resolve, 3000);
      });

      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      
      const res = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setStatus(data);
      if (data.defaultSystemPrompt) {
        setDefaultPrompt(data.defaultSystemPrompt);
      }
    } catch (err) {
      console.error("Failed to load settings.", err);
    } finally {
      setLoadingKeys(false);
    }
  }

  // Save Prompt Template
  async function handleSavePrompt() {
    setSavingPrompt(true);
    setPromptMsg(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");

      const docRef = template?.id 
        ? doc(db, "promptTemplates", template.id) 
        : doc(collection(db, "promptTemplates"));
        
      await setDoc(docRef, {
        userId: user.uid,
        name: "Default Article Generator",
        systemPrompt: systemPrompt.trim(),
        type: "article_generation",
        isDefault: true,
        updatedAt: Timestamp.now(),
        createdAt: template?.createdAt ?? Timestamp.now(),
      }, { merge: true });

      setPromptMsg({ type: "success", text: "Prompt template saved successfully." });
    } catch (err) {
      setPromptMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setSavingPrompt(false);
      setTimeout(() => setPromptMsg(null), 3000);
    }
  }

  function handleResetPrompt() {
    if (confirm("Reset to default prompt? Your custom changes will be lost unless saved.")) {
      setSystemPrompt(defaultPrompt);
    }
  }

  // Save API Keys
  async function handleSaveKeys(e: React.FormEvent) {
    e.preventDefault();
    setSavingKeys(true);
    setKeysMsg(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not logged in");
      const token = await user.getIdToken();

      const updates: Record<string, string> = {};
      for (const [k, v] of Object.entries(inputs)) {
        if (v.trim() !== "") {
          updates[k] = v.trim();
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("No changes to save");
      }

      const res = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      if (!res.ok) throw new Error("Failed to save keys");
      
      setKeysMsg({ type: "success", text: "API Keys saved successfully!" });
      
      setInputs({
        GEMINI_API_KEY: "",
        DEVTO_API_KEY: "",
        HASHNODE_API_TOKEN: "",
        HASHNODE_PUBLICATION_ID: "",
        RAPIDAPI_KEY: "",
        MEDIUM_USER_ID: "",
      });
      
      await fetchSettings();
      
    } catch (err) {
      setKeysMsg({ type: "error", text: err instanceof Error ? err.message : "Error saving keys" });
    } finally {
      setSavingKeys(false);
      setTimeout(() => setKeysMsg(null), 3000);
    }
  }

  const handleChangeKey = (key: keyof typeof inputs, value: string) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>
          Configure your workspace, AI behaviors, and integrations.
        </p>
      </div>

      {/* PROMPT SETTINGS */}
      <section
        className="rounded-2xl border p-6 mb-8"
        style={{
          background: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
        }}
      >
        <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Article Generation System Prompt
            </h2>
            <p className="mt-1 text-xs" style={{ color: "hsl(var(--muted-foreground))", maxWidth: "600px" }}>
              This defines the voice, tone, and constraints Gemini uses when generating your full article drafts.
              Use this to inject your personal writing style and strictly forbid AI cliches.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetPrompt}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
              style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={handleSavePrompt}
              disabled={loadingPrompt || savingPrompt}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
              style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
            >
              {savingPrompt ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>

        {promptMsg && (
          <div
            className="mb-4 rounded-lg px-4 py-2.5 text-sm"
            style={{
              background: promptMsg.type === "error" ? "hsl(var(--destructive) / 0.1)" : "hsl(142 70% 45% / 0.1)",
              color: promptMsg.type === "error" ? "hsl(var(--destructive))" : "hsl(142 70% 45%)",
              border: `1px solid ${promptMsg.type === "error" ? "hsl(var(--destructive) / 0.3)" : "hsl(142 70% 45% / 0.3)"}`,
            }}
          >
            {promptMsg.text}
          </div>
        )}

        {loadingPrompt ? (
          <div className="animate-pulse h-64 rounded-xl" style={{ background: "hsl(var(--muted))" }} />
        ) : (
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={18}
            className="w-full rounded-xl px-4 py-4 text-sm font-mono resize-y outline-none transition-all leading-relaxed"
            style={{
              background: "hsl(var(--muted))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
            }}
            onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--ring))")}
            onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))")}
            spellCheck={false}
          />
        )}
      </section>

      {/* API KEYS SETTINGS */}
      <section
        className="rounded-2xl border p-6 mb-8"
        style={{
          background: "hsl(var(--card))",
          borderColor: "hsl(var(--border))",
        }}
      >
        <div className="mb-5">
          <h2 className="text-sm font-semibold text-foreground">
            API Keys & Integrations
          </h2>
          <p className="mt-1 text-xs" style={{ color: "hsl(var(--muted-foreground))", maxWidth: "600px" }}>
            Configure your API keys for Gemini and publishing platforms. Your keys are encrypted and stored securely in Firestore. 
            Once saved, they cannot be viewed again, only overwritten.
          </p>
        </div>

        {keysMsg && (
          <div
            className="mb-4 rounded-lg px-4 py-2.5 text-sm"
            style={{
              background: keysMsg.type === "error" ? "hsl(var(--destructive) / 0.1)" : "hsl(142 70% 45% / 0.1)",
              color: keysMsg.type === "error" ? "hsl(var(--destructive))" : "hsl(142 70% 45%)",
              border: `1px solid ${keysMsg.type === "error" ? "hsl(var(--destructive) / 0.3)" : "hsl(142 70% 45% / 0.3)"}`,
            }}
          >
            {keysMsg.text}
          </div>
        )}

        {loadingKeys ? (
          <div className="animate-pulse h-64 rounded-xl" style={{ background: "hsl(var(--muted))" }} />
        ) : (
          <form onSubmit={handleSaveKeys} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Gemini */}
              <div className="space-y-2">
                <label className="block text-xs font-medium">Gemini API Key</label>
                <input 
                  type="password"
                  placeholder={status.GEMINI_API_KEY ? "******** (Configured)" : "Enter Gemini API Key"}
                  value={inputs.GEMINI_API_KEY}
                  onChange={e => handleChangeKey("GEMINI_API_KEY", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>

              {/* Dev.to */}
              <div className="space-y-2">
                <label className="block text-xs font-medium">Dev.to API Key</label>
                <input 
                  type="password"
                  placeholder={status.DEVTO_API_KEY ? "******** (Configured)" : "Enter Dev.to API Key"}
                  value={inputs.DEVTO_API_KEY}
                  onChange={e => handleChangeKey("DEVTO_API_KEY", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>

              {/* Hashnode Token */}
              <div className="space-y-2">
                <label className="block text-xs font-medium">Hashnode Personal Access Token</label>
                <input 
                  type="password"
                  placeholder={status.HASHNODE_API_TOKEN ? "******** (Configured)" : "Enter Hashnode Token"}
                  value={inputs.HASHNODE_API_TOKEN}
                  onChange={e => handleChangeKey("HASHNODE_API_TOKEN", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>

              {/* Hashnode Pub ID */}
              <div className="space-y-2">
                <label className="block text-xs font-medium">Hashnode Publication ID</label>
                <input 
                  type="text"
                  placeholder={status.HASHNODE_PUBLICATION_ID ? "******** (Configured)" : "Enter Publication ID"}
                  value={inputs.HASHNODE_PUBLICATION_ID}
                  onChange={e => handleChangeKey("HASHNODE_PUBLICATION_ID", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>

              {/* RapidAPI Key */}
              <div className="space-y-2">
                <label className="block text-xs font-medium">RapidAPI Key (Medium)</label>
                <input 
                  type="password"
                  placeholder={status.RAPIDAPI_KEY ? "******** (Configured)" : "Enter RapidAPI Key"}
                  value={inputs.RAPIDAPI_KEY}
                  onChange={e => handleChangeKey("RAPIDAPI_KEY", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>

              {/* Medium User ID */}
              <div className="space-y-2">
                <label className="block text-xs font-medium">Medium User ID</label>
                <input 
                  type="text"
                  placeholder={status.MEDIUM_USER_ID ? "******** (Configured)" : "Enter Medium User ID"}
                  value={inputs.MEDIUM_USER_ID}
                  onChange={e => handleChangeKey("MEDIUM_USER_ID", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <button
                type="submit"
                disabled={loadingKeys || savingKeys || Object.values(inputs).every(v => v === "")}
                className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
              >
                {savingKeys ? "Saving…" : "Save Keys"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
