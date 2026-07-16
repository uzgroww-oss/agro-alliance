import { StatusBar, Style } from "@capacitor/status-bar"
import { SplashScreen } from "@capacitor/splash-screen"
import { isNative } from "./platform"

/**
 * Native ilova ishga tushganda sozlanadigan narsalar.
 * Web'da hech narsa qilmaydi.
 */
export async function initNative(): Promise<void> {
  if (!isNative) return
  try {
    // Status bar WebView ustiga chiqmasin (notch/safe-area muammosi bo'lmasin)
    await StatusBar.setOverlaysWebView({ overlay: false })
    await StatusBar.setStyle({ style: Style.Light }) // och fon → qora matn
    await StatusBar.setBackgroundColor({ color: "#ffffff" })
  } catch {
    /* iOS'da setBackgroundColor qo'llab-quvvatlanmaydi — e'tiborsiz */
  }
  try {
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }
}
