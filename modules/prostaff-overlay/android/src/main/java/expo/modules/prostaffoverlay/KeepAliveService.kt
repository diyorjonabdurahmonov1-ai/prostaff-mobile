package expo.modules.prostaffoverlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * A foreground service that does nothing but exist.
 *
 * Android ends a background app's process within minutes, and the bubble is a
 * window that lives in that process. A worker's location service already keeps
 * it alive; a firm that does not share its position has no such service, so
 * this one holds the process while the firm is online. Its notification says
 * so, and touching it opens the app.
 */
class KeepAliveService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: "PROSTAFF"
    val body = intent?.getStringExtra(EXTRA_BODY) ?: ""
    try {
      val notification = buildNotification(this, title, body)
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Throwable) {
      // Not allowed to run as a foreground service right now: nothing to keep alive.
      stopSelf()
    }
    // Not restarted by the system: a restarted service would have no bubble and
    // no app behind it, only a notification promising something that is not there.
    return START_NOT_STICKY
  }

  private fun buildNotification(ctx: Context, title: String, body: String): Notification {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Onlayn holat", NotificationManager.IMPORTANCE_LOW)
      )
    }
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
    val tap = launch?.let {
      PendingIntent.getActivity(ctx, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(ctx, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(ctx)
    }
    val icon = if (ctx.applicationInfo.icon != 0) ctx.applicationInfo.icon else android.R.drawable.ic_dialog_info
    return builder
      .setSmallIcon(icon)
      .setContentTitle(title)
      .setContentText(body)
      .setOngoing(true)
      .setContentIntent(tap)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "prostaff_online"
    private const val NOTIFICATION_ID = 7421
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_BODY = "body"

    fun start(ctx: Context, title: String, body: String): Boolean {
      return try {
        val intent = Intent(ctx, KeepAliveService::class.java)
          .putExtra(EXTRA_TITLE, title)
          .putExtra(EXTRA_BODY, body)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          ctx.startForegroundService(intent)
        } else {
          ctx.startService(intent)
        }
        true
      } catch (_: Throwable) {
        false
      }
    }

    fun stop(ctx: Context): Boolean {
      return try {
        ctx.stopService(Intent(ctx, KeepAliveService::class.java))
        true
      } catch (_: Throwable) {
        false
      }
    }
  }
}
