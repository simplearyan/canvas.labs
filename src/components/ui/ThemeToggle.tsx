import { Show } from "solid-js";
import { isDarkTheme, toggleTheme } from "../../store/global";
import Icon from "./Icon";

export default function ThemeToggle() {
  return (
    <button onClick={toggleTheme} class="w-9 h-9 rounded-full flex items-center justify-center text-text-muted hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer outline-none">
      <Show when={isDarkTheme()} fallback={<Icon name="moon" class="w-5 h-5" />}>
        <Icon name="sun" class="w-5 h-5" />
      </Show>
    </button>
  );
}
