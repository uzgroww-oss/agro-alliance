import { Capacitor } from "@capacitor/core"

/** Native ilova (Android/iOS) ichida ishlayaptimi? Web'da false. */
export const isNative = Capacitor.isNativePlatform()

/** Platforma nomi: 'android' | 'ios' | 'web' */
export const platform = Capacitor.getPlatform()
