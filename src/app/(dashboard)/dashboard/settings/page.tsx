"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, doc, setDoc, Timestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { PromptTemplate } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, KeyRound, PenTool, ExternalLink } from "lucide-react";

export default function SettingsPage() {

  const [template, setTemplate] = useState<PromptTemplate | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [promptMsg, setPromptMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
    X_PROFILE: false,
    LINKEDIN_PROFILE: false,
    GITHUB_PROFILE: false,
    SHORT_BIO: false,
    PORTFOLIO_URL: false,
  });

  const [inputs, setInputs] = useState({
    GEMINI_API_KEY: "",
    DEVTO_API_KEY: "",
    HASHNODE_API_TOKEN: "",
    HASHNODE_PUBLICATION_ID: "",
    RAPIDAPI_KEY: "",
    MEDIUM_USER_ID: "",
    X_PROFILE: "",
    LINKEDIN_PROFILE: "",
    GITHUB_PROFILE: "",
    SHORT_BIO: "",
    PORTFOLIO_URL: "",
  });

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
          setCustomInstructions(data.customInstructions || "");
        } else {
          setCustomInstructions("");
        }
        setLoadingPrompt(false);
      });

      return () => unsub();
    });

    return () => unsubAuth();
  }, [defaultPrompt]);

  useEffect(() => {

  }, [defaultPrompt, template]);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {

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

      const newStatus: Record<string, boolean> = {};
      const newInputs: Record<string, string> = { ...inputs };
      
      Object.keys(inputs).forEach(k => {
        if (typeof data[k] === 'boolean') {
          newStatus[k] = data[k];
        } else if (typeof data[k] === 'string') {
          newInputs[k] = data[k];
          newStatus[k] = !!data[k];
        }
      });
      
      setStatus(prev => ({ ...prev, ...newStatus } as typeof status));
      setInputs(newInputs as typeof inputs);
      if (data.defaultSystemPrompt) {
        setDefaultPrompt(data.defaultSystemPrompt);
      }
    } catch (err) {
      console.error("Failed to load settings.", err);
    } finally {
      setLoadingKeys(false);
    }
  }

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
        systemPrompt: defaultPrompt, // we preserve the default system prompt base
        customInstructions: customInstructions.trim(),
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
    if (confirm("Reset to default (remove custom instructions)? Your changes will be lost unless saved.")) {
      setCustomInstructions("");
    }
  }

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
        X_PROFILE: inputs.X_PROFILE,
        LINKEDIN_PROFILE: inputs.LINKEDIN_PROFILE,
        GITHUB_PROFILE: inputs.GITHUB_PROFILE,
        SHORT_BIO: inputs.SHORT_BIO,
        PORTFOLIO_URL: inputs.PORTFOLIO_URL,
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
    <div className="max-w-5xl mx-auto w-full space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your workspace, AI behaviors, and integrations.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            API Keys & Integrations
          </CardTitle>
          <CardDescription className="max-w-[600px]">
            Configure your API keys for Gemini and publishing platforms. Your keys are encrypted and stored securely in Firestore. 
            Once saved, they cannot be viewed again, only overwritten.
          </CardDescription>
        </CardHeader>
        <CardContent>

        {keysMsg && (
          <Alert variant={keysMsg.type === "error" ? "destructive" : "default"} className={`mb-4 ${keysMsg.type === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-600' : ''}`}>
            <AlertDescription>{keysMsg.text}</AlertDescription>
          </Alert>
        )}

        {loadingKeys ? (
          <div className="animate-pulse h-64 rounded-xl bg-muted" />
        ) : (
          <form onSubmit={handleSaveKeys} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium">Gemini API Key</label>
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    Get Key <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input 
                  type="password"
                  placeholder={status.GEMINI_API_KEY ? "******** (Configured)" : "Enter Gemini API Key"}
                  value={inputs.GEMINI_API_KEY}
                  onChange={e => handleChangeKey("GEMINI_API_KEY", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium">Dev.to API Key</label>
                  <a href="https://dev.to/settings/extensions" target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline flex items-center gap-1">
                    Get Key <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input 
                  type="password"
                  placeholder={status.DEVTO_API_KEY ? "******** (Configured)" : "Enter Dev.to API Key"}
                  value={inputs.DEVTO_API_KEY}
                  onChange={e => handleChangeKey("DEVTO_API_KEY", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                />
              </div>

              <div className="space-y-2 opacity-50 pointer-events-none">
                <label className="block text-xs font-medium">Hashnode Personal Access Token (Coming soon...)</label>
                <input 
                  type="password"
                  placeholder="Coming soon..."
                  value={inputs.HASHNODE_API_TOKEN}
                  onChange={e => handleChangeKey("HASHNODE_API_TOKEN", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                  disabled
                />
              </div>

              <div className="space-y-2 opacity-50 pointer-events-none">
                <label className="block text-xs font-medium">Hashnode Publication ID (Coming soon...)</label>
                <input 
                  type="text"
                  placeholder="Coming soon..."
                  value={inputs.HASHNODE_PUBLICATION_ID}
                  onChange={e => handleChangeKey("HASHNODE_PUBLICATION_ID", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                  disabled
                />
              </div>

              <div className="space-y-2 opacity-50 pointer-events-none">
                <label className="block text-xs font-medium">RapidAPI Key (Medium - Coming soon...)</label>
                <input 
                  type="password"
                  placeholder="Coming soon..."
                  value={inputs.RAPIDAPI_KEY}
                  onChange={e => handleChangeKey("RAPIDAPI_KEY", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                  disabled
                />
              </div>

              <div className="space-y-2 opacity-50 pointer-events-none">
                <label className="block text-xs font-medium">Medium User ID (Coming soon...)</label>
                <input 
                  type="text"
                  placeholder="Coming soon..."
                  value={inputs.MEDIUM_USER_ID}
                  onChange={e => handleChangeKey("MEDIUM_USER_ID", e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                  disabled
                />
              </div>
            </div>

            <div className="pt-6 mt-6 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <h3 className="text-sm font-semibold mb-4 text-foreground">Profile Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-medium">X (Twitter) Profile URL</label>
                  <input 
                    type="url"
                    placeholder="https://x.com/username"
                    value={inputs.X_PROFILE}
                    onChange={e => handleChangeKey("X_PROFILE", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium">LinkedIn Profile URL</label>
                  <input 
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={inputs.LINKEDIN_PROFILE}
                    onChange={e => handleChangeKey("LINKEDIN_PROFILE", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium">GitHub Profile URL</label>
                  <input 
                    type="url"
                    placeholder="https://github.com/username"
                    value={inputs.GITHUB_PROFILE}
                    onChange={e => handleChangeKey("GITHUB_PROFILE", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-medium">Portfolio Website URL</label>
                  <input 
                    type="url"
                    placeholder="https://yourwebsite.com"
                    value={inputs.PORTFOLIO_URL}
                    onChange={e => handleChangeKey("PORTFOLIO_URL", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-background"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-xs font-medium">Short Bio</label>
                  <textarea 
                    rows={3}
                    placeholder="A brief introduction about yourself..."
                    value={inputs.SHORT_BIO}
                    onChange={e => handleChangeKey("SHORT_BIO", e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border bg-background resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-6 border-t border-border">
              <Button
                type="submit"
                disabled={loadingKeys || savingKeys || Object.values(inputs).every(v => v === "")}
              >
                {savingKeys ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {savingKeys ? "Saving…" : "Save Keys"}
              </Button>
            </div>
          </form>
        )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <CardTitle className="text-lg flex items-center gap-2">
                <PenTool className="w-5 h-5 text-primary" />
                Custom Article Instructions
              </CardTitle>
              <CardDescription className="max-w-[600px]">
                {"These instructions will be appended to the AI's system prompt during article generation."} 
                {"Use this to inject your personal writing style, format preferences, and strictly forbid AI cliches."}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetPrompt}
              >
                Reset to default
              </Button>
              <Button
                size="sm"
                onClick={handleSavePrompt}
                disabled={loadingPrompt || savingPrompt}
              >
                {savingPrompt ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {savingPrompt ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>

        {promptMsg && (
          <Alert variant={promptMsg.type === "error" ? "destructive" : "default"} className={`mb-4 ${promptMsg.type === 'success' ? 'border-green-500/20 bg-green-500/10 text-green-600' : ''}`}>
            <AlertDescription>{promptMsg.text}</AlertDescription>
          </Alert>
        )}

        {loadingPrompt ? (
          <div className="animate-pulse h-64 rounded-xl bg-muted" />
        ) : (
          <textarea
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            rows={8}
            placeholder="E.g., Never use the word 'delve'. Always keep sentences short. Sound like a pragmatic senior engineer..."
            className="w-full rounded-xl px-4 py-4 text-sm font-mono resize-y outline-none transition-all leading-relaxed bg-muted text-foreground border border-border focus:border-ring"
            spellCheck={false}
          />
        )}
        </CardContent>
      </Card>
    </div>
  );
}
