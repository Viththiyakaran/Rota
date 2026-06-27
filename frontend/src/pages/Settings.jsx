import React from "react";
import { ImagePlus, RotateCcw, Save } from "lucide-react";
import { api } from "../api.js";
import { Card } from "../components/Card.jsx";
import { Field, inputClass } from "../components/Field.jsx";

export function Settings({ branding, onBrandingSaved }) {
  const [form, setForm] = React.useState(branding);
  const [error, setError] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm(branding);
  }, [branding]);

  const chooseLogo = (event) => {
    const file = event.target.files?.[0];
    setError("");
    setMessage("");
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for the logo.");
      return;
    }
    if (file.size > 500 * 1024) {
      setError("Logo image is too large. Use an image under 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setForm((current) => ({ ...current, logoDataUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const saved = await api.updateBranding(form);
      onBrandingSaved(saved);
      setMessage("Branding updated.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-fuel-green">Admin</p>
        <h2 className="text-3xl font-black">Business Settings</h2>
      </div>

      <Card>
        <form className="space-y-4" onSubmit={save}>
          {error && <p className="rounded-md bg-red-50 p-3 font-bold text-red-700">{error}</p>}
          {message && <p className="rounded-md bg-fuel-mist p-3 font-bold text-fuel-green">{message}</p>}

          <Field label="Business name">
            <input
              required
              className={inputClass}
              value={form.businessName || ""}
              onChange={(event) => setForm({ ...form, businessName: event.target.value })}
              placeholder="Your business name"
            />
          </Field>

          <Field label="Logo image">
            <div className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-md border border-fuel-line bg-fuel-mist">
                {form.logoDataUrl ? (
                  <img src={form.logoDataUrl} alt="" className="h-full w-full rounded-md object-contain p-1" />
                ) : (
                  <span className="text-2xl font-black text-fuel-green">
                    {String(form.businessName || "R").trim().charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-fuel-green px-4 py-3 font-black text-white shadow-soft">
                  <ImagePlus size={18} />
                  Upload Logo
                  <input className="hidden" type="file" accept="image/*" onChange={chooseLogo} />
                </label>
                <button
                  type="button"
                  className="ml-2 inline-flex items-center gap-2 rounded-md bg-fuel-mist px-4 py-3 font-black text-fuel-green"
                  onClick={() => setForm({ ...form, logoDataUrl: "" })}
                >
                  <RotateCcw size={18} />
                  Remove
                </button>
                <p className="text-xs font-bold text-slate-500">Use a square PNG/JPG under 500KB.</p>
              </div>
            </div>
          </Field>

          <button
            className="flex w-full items-center justify-center gap-2 rounded-md bg-fuel-ink px-5 py-4 text-lg font-black text-white shadow-lift disabled:opacity-60"
            disabled={saving}
          >
            <Save size={20} />
            {saving ? "Saving..." : "Save Branding"}
          </button>
        </form>
      </Card>
    </div>
  );
}
