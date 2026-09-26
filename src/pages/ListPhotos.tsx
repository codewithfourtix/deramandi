import { useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate } from "react-router";
import { CameraGuide } from "../components/CameraGuide";
import { CameraIcon, CloseIcon, GalleryIcon } from "../components/Icons";
import { Steps } from "../components/Steps";
import {
  gradeCrop,
  gradeLot,
  ModelUnavailable,
  PhotoProblem,
} from "../lib/grader";
import { fileToDataUrl } from "../lib/image";
import { drawSample, type SampleQuality } from "../lib/samples";
import { listingBand } from "../lib/match";
import { addListing, newId, StorageFullError } from "../lib/storage";
import { useDraft } from "../state/draftContext";
import { sayIfOn, useVoiceLine } from "../lib/voice";
import type { Listing } from "../types";

const MAX_SAMPLE = 3;
const MAX_LOT = 10;
// Long enough that the check registers as a real step, short enough not to annoy.
const MIN_GRADING_MS = 1400;
const SAMPLES_PER_GRADE = 2;

export function ListPhotos() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { draft, update, reset } = useDraft();
  const [error, setError] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [badPhoto, setBadPhoto] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [liveCamera, setLiveCamera] = useState(false);
  // After the live camera fails once (no permission, no camera), use the phone's own picker.
  const [nativeCamera, setNativeCamera] = useState(
    () => !navigator.mediaDevices?.getUserMedia,
  );
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const tipKey =
    draft.mode === "lot" && draft.crop !== "wheat"
      ? "lot.tip"
      : ((
          {
            dhakki_dates: "photosDates.tip",
            wheat: "photosWheat.tip",
            sugarcane: "photosSugarcane.tip",
          } as Record<string, string>
        )[draft.crop ?? ""] ?? "photos.tip");
  useVoiceLine(grading ? null : [tipKey, "voice.photos"]);

  if (!finished && (!draft.crop || !draft.quantityKg || !draft.location)) {
    return <Navigate to="/list" replace />;
  }

  const photos = draft.photos;
  const lotMode = draft.mode === "lot" && draft.crop !== "wheat";
  const maxPhotos = lotMode ? MAX_LOT : MAX_SAMPLE;
  const full = photos.length >= maxPhotos;
  const isDates = draft.crop === "dhakki_dates";

  async function addFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow picking the same file again
    await addFileList(files);
  }

  // Wheat is graded kernel by kernel, so its photos keep more detail.
  const storeSide = draft.crop === "wheat" ? 1600 : 640;

  async function addFileList(files: File[]) {
    if (!files.length) return;
    setError(null);
    setBadPhoto(null);
    const room = maxPhotos - photos.length;
    if (files.length > room) setError(t("photos.max"));
    const added: string[] = [];
    for (const file of files.slice(0, room)) {
      try {
        added.push(
          await fileToDataUrl(
            file,
            storeSide,
            draft.crop === "wheat" ? 0.85 : 0.72,
          ),
        );
      } catch {
        setError(t("photos.readError"));
      }
    }
    // functional update: camera shots can arrive while an earlier one is still being read
    if (added.length)
      update((prev) => ({
        photos: [...prev.photos, ...added].slice(0, maxPhotos),
      }));
  }

  function addSample(quality: SampleQuality) {
    if (!draft.crop || full) return;
    setError(null);
    setBadPhoto(null);
    update({
      photos: [...photos, drawSample(draft.crop, quality, photos.length + 1)],
    });
  }

  // Khajoor samples are real held-out photos from the training dataset.
  async function addDateSample(grade: 1 | 2 | 3) {
    if (full) return;
    setError(null);
    setBadPhoto(null);
    try {
      const n = (photos.length % SAMPLES_PER_GRADE) + 1;
      const blob = await (
        await fetch(`/samples/khajoor-g${grade}-${n}.jpg`)
      ).blob();
      const url = await fileToDataUrl(
        new File([blob], "sample.jpg", { type: blob.type || "image/jpeg" }),
      );
      update({ photos: [...photos, url] });
    } catch {
      setError(t("photos.readError"));
    }
  }

  function removePhoto(i: number) {
    update({ photos: photos.filter((_, idx) => idx !== i) });
    setError(null);
    setBadPhoto(null);
  }

  async function grade() {
    if (!photos.length || !draft.crop || !draft.quantityKg) return;
    setGrading(true);
    setError(null);
    sayIfOn(["voice.grading"]);
    try {
      const crop = draft.crop;
      const [result] = await Promise.all([
        lotMode ? gradeLot(photos, crop) : gradeCrop(photos, crop),
        new Promise((r) => setTimeout(r, MIN_GRADING_MS)),
      ]);
      const band = listingBand({
        crop,
        grade: result.grade,
        lotCounts: result.lotCounts,
      });
      const listing: Listing = {
        id: newId(),
        crop,
        variety: draft.variety.trim() || undefined,
        quantityKg: draft.quantityKg,
        location: draft.location,
        photos,
        grade: result.grade,
        gradeConfidence: result.confidence,
        gradeFactors: result.factors,
        gradeSource: result.source,
        gradeProbabilities: result.probabilities,
        gradePerPhoto: result.perPhoto,
        gradeUnfamiliar: result.unfamiliar,
        lotCounts: result.lotCounts,
        specs: result.specs,
        farmerId: draft.farmerId,
        priceMin: band.min,
        priceMax: band.max,
        referencePrice: Math.round(((band.min + band.max) / 2) * 10) / 10,
        status: "listed",
        createdAt: new Date().toISOString(),
      };
      await addListing(listing);
      setFinished(true);
      navigate(`/listing/${listing.id}`, {
        replace: true,
        state: { reveal: true },
      });
      reset();
    } catch (err) {
      setGrading(false);
      if (err instanceof ModelUnavailable) {
        setError(t("model.unavailable"));
      } else if (err instanceof PhotoProblem) {
        setBadPhoto(err.photoIndex);
        sayIfOn(["voice.photoProblem"]);
        setError(t(`photos.issue.${err.issue}`, { n: err.photoIndex + 1 }));
      } else {
        setError(
          err instanceof StorageFullError
            ? t("photos.storageFull")
            : t("photos.gradeError"),
        );
      }
    }
  }

  return (
    <div>
      <Steps current={2} />
      <h1 className="display text-[1.7rem]">{t("photos.title")}</h1>
      {/* Wheat photos are already a lot sample: every kernel in a handful is graded. */}
      {draft.crop !== "wheat" && (
        <fieldset className="m-0 mt-4 border-0 p-0">
          <legend className="field-label">{t("lot.modeLabel")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["sample", "lot"] as const).map((m) => {
              const on = (draft.mode ?? "sample") === m;
              return (
                <label
                  key={m}
                  className={`flex min-h-11 cursor-pointer flex-col justify-center rounded-md border-2 px-3 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-indus ${on ? "border-soil bg-date-wash" : "border-line bg-sheet"}`}
                >
                  <input
                    type="radio"
                    name="grade-mode"
                    value={m}
                    checked={on}
                    disabled={grading}
                    onChange={() =>
                      update({
                        mode: m,
                        photos:
                          m === "sample" ? photos.slice(0, MAX_SAMPLE) : photos,
                      })
                    }
                    className="sr-only"
                  />
                  <span className="font-bold">{t(`lot.mode_${m}`)}</span>
                  <span className="text-[0.9rem] text-soil-soft">
                    {t(`lot.mode_${m}_hint`)}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <p className="mt-3 text-soil-soft">{t(tipKey)}</p>

      {/* Two inputs on purpose: `capture` alone hides the gallery on Android. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        onChange={addFiles}
        aria-hidden="true"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={addFiles}
        aria-hidden="true"
      />

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="btn btn-quiet flex-col gap-1 py-3"
          disabled={full || grading}
          onClick={() =>
            nativeCamera ? cameraRef.current?.click() : setLiveCamera(true)
          }
        >
          <CameraIcon />
          {t("photos.camera")}
        </button>
        <button
          type="button"
          className="btn btn-quiet flex-col gap-1 py-3"
          disabled={full || grading}
          onClick={() => galleryRef.current?.click()}
        >
          <GalleryIcon />
          {t("photos.gallery")}
        </button>
      </div>

      <p className="mt-5 text-[0.95rem] font-bold" aria-live="polite">
        {t("photos.count", { count: photos.length, max: maxPhotos })}
      </p>
      <ul
        className={`m-0 mt-2 grid list-none gap-2 p-0 ${lotMode ? "grid-cols-4 sm:grid-cols-5" : "grid-cols-3"}`}
      >
        {Array.from({ length: maxPhotos }).map((_, i) => {
          const src = photos[i];
          return (
            <li
              key={i}
              className={`relative aspect-square overflow-hidden rounded-md ${badPhoto === i ? "outline-4 outline-offset-2 outline-warn" : ""}`}
            >
              {src ? (
                <>
                  <img
                    src={src}
                    alt={t("photos.photoAlt", { n: i + 1 })}
                    className="h-full w-full object-cover"
                  />
                  {grading && (
                    <span
                      className="absolute inset-0 bg-soil/25"
                      aria-hidden="true"
                    >
                      <span className="scan-line absolute inset-x-0 h-0.5 bg-date shadow-[0_0_10px_2px_var(--color-date)]" />
                    </span>
                  )}
                  {!grading && (
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label={t("photos.remove", { n: i + 1 })}
                      className="absolute end-1 top-1 flex h-11 w-11 items-center justify-center rounded-full bg-soil/85 text-paper hover:bg-soil"
                    >
                      <CloseIcon />
                    </button>
                  )}
                </>
              ) : (
                <span
                  className="flex h-full w-full items-center justify-center border-2 border-dashed border-line text-2xl text-line"
                  aria-hidden="true"
                >
                  <span className="num">{i + 1}</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {photos.length === 0 && (
        <p className="mt-3 text-soil-soft">{t("photos.empty")}</p>
      )}

      <details className="group mt-5 rounded-md border-2 border-dashed border-line px-3 py-1 open:pb-3">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold text-indus">
          {isDates ? t("photosDates.samplesToggle") : t("photos.samplesToggle")}
        </summary>
        <p className="text-[0.95rem] text-soil-soft">
          {isDates ? t("photosDates.samplesNote") : t("photos.samplesNote")}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {isDates
            ? ([1, 2, 3] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  className="btn btn-quiet min-h-11 px-2 text-[0.95rem]"
                  disabled={full || grading}
                  onClick={() => addDateSample(g)}
                >
                  {t(`photosDates.sample.g${g}`)}
                </button>
              ))
            : (["good", "mixed", "poor"] as const).map((q) => (
                <button
                  key={q}
                  type="button"
                  className="btn btn-quiet min-h-11 px-2 text-[0.95rem]"
                  disabled={full || grading}
                  onClick={() => addSample(q)}
                >
                  {t(`photos.sample.${q}`)}
                </button>
              ))}
        </div>
      </details>

      {liveCamera && draft.crop && (
        <CameraGuide
          crop={draft.crop}
          remaining={maxPhotos - photos.length}
          onPhoto={(file) => addFileList([file])}
          onClose={() => setLiveCamera(false)}
          onUnavailable={() => {
            setLiveCamera(false);
            setNativeCamera(true);
            setError(t("camera.unavailable"));
          }}
        />
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md bg-warn-wash px-3 py-2 font-bold text-warn"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        className={`btn btn-primary mt-8 w-full ${grading ? "disabled:border-soil disabled:bg-soil disabled:text-paper" : ""}`}
        disabled={!photos.length || grading}
        onClick={grade}
        aria-busy={grading}
      >
        {grading
          ? isDates
            ? t("model.loading")
            : t("photos.grading")
          : t("photos.grade")}
      </button>
      {grading && (
        <p className="sr-only" role="status">
          {t("photos.grading")}
        </p>
      )}
    </div>
  );
}
