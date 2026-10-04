import { initNavigation } from "./js/navigation.js";
import { createFilesTray } from "./js/files-tray.js";
import { createChatDemo } from "./js/chat-demo.js";
import { initAiPanel } from "./js/ai-panel.js";

const mobileNavMq = window.matchMedia("(max-width: 1023.98px)");
const reducedMotionMq = window.matchMedia("(prefers-reduced-motion: reduce)");

document.querySelector(".skip-link")?.addEventListener("click", () => {
  document.querySelector("#main")?.focus();
});

document.querySelector(".search")?.addEventListener("submit", (event) => {
  event.preventDefault();
});

initNavigation({ mobileNavMq });

const wrapper = document.querySelector(".spire-wrapper");
const chatPanel = wrapper?.querySelector(".panel-chat");

if (wrapper && chatPanel) {
  const filesTray = createFilesTray({ reducedMotionMq });
  const chat = createChatDemo({ wrapper, chatPanel, reducedMotionMq, filesTray });

  initAiPanel({ wrapper, mobileNavMq, chat, filesTray });
}
