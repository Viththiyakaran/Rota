import React from "react";
import { Camera, Trash2 } from "lucide-react";
import { StaffAvatar } from "./StaffAvatar.jsx";
import { softButton } from "./PageHeader.jsx";

const MAX_SOURCE_BYTES = 5 * 1024 * 1024;

export function AvatarField({ name = "Staff", onChange, value = "" }) {
  const inputId = React.useId();
  const [error, setError] = React.useState("");
  const [processing, setProcessing] = React.useState(false);

  const selectPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (!/^image\/(?:png|jpeg|webp)$/i.test(file.type)) {
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError("Choose an image smaller than 5MB.");
      return;
    }

    setProcessing(true);
    try {
      onChange(await makeSquareAvatar(file));
    } catch (_error) {
      setError("This image could not be prepared. Please choose another photo.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="rounded-xl border border-fuel-line bg-slate-50 p-4">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <StaffAvatar avatarDataUrl={value} className="h-20 w-20 text-2xl" name={name} rounded="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="font-black text-fuel-ink">Profile photo</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Square photos work best. The image is resized automatically.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <label htmlFor={inputId} className={`${softButton} cursor-pointer`}>
              <Camera size={17} />
              {processing ? "Preparing..." : value ? "Change photo" : "Upload photo"}
            </label>
            <input id={inputId} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPhoto} disabled={processing} />
            {value && (
              <button type="button" className={`${softButton} text-red-700`} onClick={() => onChange("")}>
                <Trash2 size={16} />
                Remove
              </button>
            )}
          </div>
          {error && <p className="mt-2 text-xs font-bold text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}

function makeSquareAvatar(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      try {
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - size) / 2;
        const sourceY = (image.naturalHeight - size) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 320;
        const context = canvas.getContext("2d");
        context.drawImage(image, sourceX, sourceY, size, size, 0, 0, 320, 320);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Invalid image"));
    };
    image.src = objectUrl;
  });
}
