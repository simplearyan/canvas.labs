import { SITE_CONFIG } from "../../config/site";

export default function Logo(props: { class?: string }) {
  const base = "/canvas.labs";
  return (
    <a href={base} class={`flex items-center gap-3 group ${props.class || ""}`}>
      <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2c2c2c] to-[#121212] border border-white/5 flex items-center justify-center">
        <span class="font-sans font-black text-white tracking-tighter leading-none flex items-center justify-center" style="font-size: 14px; margin-top: 1px;">{SITE_CONFIG.branding.acronym}</span>
      </div>
      <span class="text-base sm:text-xl font-bold tracking-tight text-text-main leading-none flex items-center">{SITE_CONFIG.branding.name}</span>
    </a>
  );
}
