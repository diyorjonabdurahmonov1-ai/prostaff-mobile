package expo.modules.prostaffoverlay

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The floating bubble and the "display over other apps" permission, for a
 * provider who is online with the app out of sight.
 *
 * Everything here is best-effort and returns a Boolean instead of throwing: the
 * bubble is a convenience, and a phone that refuses to draw it must never be
 * able to take the app down with it.
 */
class ProstaffOverlayModule : Module() {
  private val context: Context?
    get() = appContext.reactContext?.applicationContext

  override fun definition() = ModuleDefinition {
    Name("ProstaffOverlay")

    // Whether the user has allowed this app to draw over other apps.
    Function("canDrawOverlays") {
      val ctx = context ?: return@Function false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      try {
        Settings.canDrawOverlays(ctx)
      } catch (_: Throwable) {
        false
      }
    }

    // Opens the system screen where this app's permission is switched on, with
    // the app already selected: one tap on the switch is all that is left.
    Function("openOverlaySettings") {
      val ctx = context ?: return@Function false
      try {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${ctx.packageName}")
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val activity = appContext.currentActivity
        if (activity != null) activity.startActivity(intent) else ctx.startActivity(intent)
        true
      } catch (_: Throwable) {
        false
      }
    }

    // Puts the bubble on screen (or updates its label).
    Function("showBubble") { label: String ->
      val ctx = context ?: return@Function false
      BubbleOverlay.show(ctx, label)
    }

    // The bubble turns into an alert: bigger, pulsing, with the text beside it.
    Function("ringBubble") { label: String ->
      val ctx = context ?: return@Function false
      BubbleOverlay.ring(ctx, label)
    }

    Function("hideBubble") {
      val ctx = context ?: return@Function false
      BubbleOverlay.hide(ctx)
    }

    // Holds the app's process while a provider is online (see KeepAliveService).
    Function("startKeepAlive") { title: String, body: String ->
      val ctx = context ?: return@Function false
      KeepAliveService.start(ctx, title, body)
    }

    Function("stopKeepAlive") {
      val ctx = context ?: return@Function false
      KeepAliveService.stop(ctx)
    }

    // Brings the app back in front of whatever is on screen. Only works while
    // the permission is granted and the bubble is showing.
    Function("bringToFront") {
      val ctx = context ?: return@Function false
      BubbleOverlay.openApp(ctx)
    }
  }
}
