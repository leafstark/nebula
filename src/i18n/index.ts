import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import zhCN from "./locales/zh-CN.json"
import enUS from "./locales/en-US.json"

export const resources = {
  zh: { translation: zhCN },
  en: { translation: enUS },
}

// Detect language from localStorage or browser
const saved = localStorage.getItem("lang")
const browser = (navigator.language || "zh").toLowerCase().startsWith("en")
  ? "en"
  : "zh"
const lng = saved || browser

if (!saved) {
  localStorage.setItem("lang", lng)
}

i18n.use(initReactI18next).init({
  resources,
  lng,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

export function changeLanguage(l: "en" | "zh") {
  i18n.changeLanguage(l)
  localStorage.setItem("lang", l)
}

export default i18n
