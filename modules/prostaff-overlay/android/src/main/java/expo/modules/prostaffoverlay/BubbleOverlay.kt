package expo.modules.prostaffoverlay

import android.animation.ObjectAnimator
import android.animation.PropertyValuesHolder
import android.animation.ValueAnimator
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * The floating pill: the app's icon and a short word ("Onlayn") in a rounded
 * bar over everything else, draggable to a screen edge. When an order arrives it
 * turns orange, pulses and says so; touching it opens the app.
 *
 * It is a window owned by the process, not by an activity, so it stays up when
 * the app is sent to the background and for as long as the process lives — the
 * location service or the keep-alive service holds the process for an online
 * provider. It is built in code, with no layout files, so there is nothing for a
 * resource merge to get wrong, and every entry point catches Throwable: a window
 * that cannot be added (permission revoked a second ago, a vendor restriction) is
 * simply not shown.
 */
internal object BubbleOverlay {
  private val main = Handler(Looper.getMainLooper())

  private var root: LinearLayout? = null
  private var label: TextView? = null
  private var params: WindowManager.LayoutParams? = null
  private var pulse: ObjectAnimator? = null
  private var lastX = 0
  private var lastY = 0
  private var positioned = false

  private const val IDLE_COLOR = "#16A34A"
  private const val RING_COLOR = "#F97316"

  private fun dp(ctx: Context, v: Int): Int = (v * ctx.resources.displayMetrics.density).toInt()

  private fun windowManager(ctx: Context): WindowManager =
    ctx.getSystemService(Context.WINDOW_SERVICE) as WindowManager

  /** Runs on the main thread — windows can only be touched from there. */
  private inline fun onMain(crossinline block: () -> Unit): Boolean {
    return try {
      if (Looper.myLooper() == Looper.getMainLooper()) block() else main.post {
        try {
          block()
        } catch (_: Throwable) {
        }
      }
      true
    } catch (_: Throwable) {
      false
    }
  }

  fun show(ctx: Context, text: String): Boolean = onMain {
    ensure(ctx)
    label?.text = text
    setRinging(false)
  }

  fun ring(ctx: Context, text: String): Boolean = onMain {
    ensure(ctx)
    label?.text = text
    setRinging(true)
  }

  fun hide(ctx: Context): Boolean = onMain {
    pulse?.cancel()
    pulse = null
    root?.let {
      try {
        windowManager(ctx).removeView(it)
      } catch (_: Throwable) {
      }
    }
    root = null
    label = null
    params = null
  }

  fun openApp(ctx: Context): Boolean {
    return try {
      val intent = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: return false
      intent.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED or
          Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
          Intent.FLAG_ACTIVITY_SINGLE_TOP
      )
      ctx.startActivity(intent)
      true
    } catch (_: Throwable) {
      false
    }
  }

  private fun pillBackground(ctx: Context, color: String): GradientDrawable =
    GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = dp(ctx, 40).toFloat()
      setColor(Color.parseColor(color))
      setStroke(dp(ctx, 2), Color.WHITE)
    }

  private fun setRinging(ringing: Boolean) {
    val pill = root ?: return
    pill.background = pillBackground(pill.context, if (ringing) RING_COLOR else IDLE_COLOR)
    label?.textSize = if (ringing) 15f else 14f
    pulse?.cancel()
    pulse = null
    if (ringing) {
      pulse = ObjectAnimator.ofPropertyValuesHolder(
        pill,
        PropertyValuesHolder.ofFloat(View.SCALE_X, 1f, 1.1f),
        PropertyValuesHolder.ofFloat(View.SCALE_Y, 1f, 1.1f)
      ).apply {
        duration = 450
        repeatCount = ValueAnimator.INFINITE
        repeatMode = ValueAnimator.REVERSE
        start()
      }
    } else {
      pill.scaleX = 1f
      pill.scaleY = 1f
    }
    // The window grows and shrinks with its text.
    try {
      windowManager(pill.context).updateViewLayout(pill, params)
    } catch (_: Throwable) {
    }
  }

  private fun ensure(ctx: Context) {
    if (root != null) return

    val iconSize = dp(ctx, 42)
    // The app's own icon on a white disc, so it reads as this app and not as a
    // system dot.
    val disc = FrameLayout(ctx).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.WHITE)
      }
      layoutParams = LinearLayout.LayoutParams(iconSize, iconSize)
    }
    try {
      val icon = ImageView(ctx).apply {
        setImageDrawable(ctx.packageManager.getApplicationIcon(ctx.packageName))
        scaleType = ImageView.ScaleType.CENTER_INSIDE
        val pad = dp(ctx, 7)
        setPadding(pad, pad, pad, pad)
      }
      disc.addView(icon, FrameLayout.LayoutParams(iconSize, iconSize))
    } catch (_: Throwable) {
    }

    val text = TextView(ctx).apply {
      setTextColor(Color.WHITE)
      textSize = 14f
      setTypeface(typeface, Typeface.BOLD)
      maxLines = 1
      val lp = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
      lp.marginStart = dp(ctx, 8)
      lp.marginEnd = dp(ctx, 6)
      layoutParams = lp
    }

    val pill = LinearLayout(ctx).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      background = pillBackground(ctx, IDLE_COLOR)
      elevation = dp(ctx, 6).toFloat()
      setPadding(dp(ctx, 4), dp(ctx, 4), dp(ctx, 12), dp(ctx, 4))
      addView(disc)
      addView(text)
    }

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }
    val lp = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      if (!positioned) {
        lastX = 0
        lastY = dp(ctx, 220)
        positioned = true
      }
      x = lastX
      y = lastY
    }

    pill.setOnTouchListener(DragOrTap(ctx, lp))
    windowManager(ctx).addView(pill, lp)

    root = pill
    label = text
    params = lp
  }

  /** A short touch opens the app; a longer drag moves the pill and parks it at an edge. */
  private class DragOrTap(
    private val ctx: Context,
    private val lp: WindowManager.LayoutParams
  ) : View.OnTouchListener {
    private var startX = 0
    private var startY = 0
    private var touchX = 0f
    private var touchY = 0f
    private var dragged = false
    private val slop = dp(ctx, 8)

    override fun onTouch(v: View, event: MotionEvent): Boolean {
      return try {
        when (event.action) {
          MotionEvent.ACTION_DOWN -> {
            startX = lp.x
            startY = lp.y
            touchX = event.rawX
            touchY = event.rawY
            dragged = false
            true
          }
          MotionEvent.ACTION_MOVE -> {
            val dx = (event.rawX - touchX).toInt()
            val dy = (event.rawY - touchY).toInt()
            if (abs(dx) > slop || abs(dy) > slop) dragged = true
            if (dragged) {
              lp.x = startX + dx
              lp.y = startY + dy
              windowManager(ctx).updateViewLayout(v, lp)
            }
            true
          }
          MotionEvent.ACTION_UP -> {
            if (dragged) {
              val screen = ctx.resources.displayMetrics.widthPixels
              lp.x = if (lp.x + v.width / 2 < screen / 2) 0 else screen - v.width
              lastX = lp.x
              lastY = lp.y
              windowManager(ctx).updateViewLayout(v, lp)
            } else {
              openApp(ctx)
            }
            true
          }
          else -> false
        }
      } catch (_: Throwable) {
        false
      }
    }
  }
}
