package expo.modules.studyfocusmode

import android.app.AlarmManager
import android.app.AutomaticZenRule
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.provider.Settings
import android.service.notification.Condition
import android.service.notification.ConditionProviderService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val PREFS = "study_focus_rule"
private const val RULE_ID = "rule_id"
private const val EXPIRY_ACTION = "expo.modules.studyfocusmode.EXPIRE"

class StudyFocusConditionProvider : ConditionProviderService() {
  override fun onConnected() = Unit
  override fun onSubscribe(conditionId: Uri) = Unit
  override fun onUnsubscribe(conditionId: Uri) = Unit
}

class StudyFocusExpiryReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == EXPIRY_ACTION || intent.action == Intent.ACTION_BOOT_COMPLETED) {
      try {
        StudyFocusRule.setOwnRule(context, false)
      } catch (_: SecurityException) {
        // Permission can be revoked while the app is not running.
      }
    }
  }
}

private object StudyFocusRule {
  private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)
  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  private fun conditionId(context: Context) = Uri.parse("condition://${context.packageName}/study-focus")
  private fun expiryIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context, 0,
    Intent(context, StudyFocusExpiryReceiver::class.java).setAction(EXPIRY_ACTION),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
  )

  fun supported() = Build.VERSION.SDK_INT >= 35
  fun hasAccess(context: Context) = supported() && manager(context).isNotificationPolicyAccessGranted

  fun ownRuleActive(context: Context): Boolean {
    if (!hasAccess(context)) return false
    val id = prefs(context).getString(RULE_ID, null) ?: return false
    return manager(context).getAutomaticZenRuleState(id) == Condition.STATE_TRUE
  }

  private fun ownRuleId(context: Context): String {
    val notificationManager = manager(context)
    val saved = prefs(context).getString(RULE_ID, null)
    if (saved != null && notificationManager.getAutomaticZenRule(saved) != null) return saved
    val rule = AutomaticZenRule.Builder("독서실 공부 집중", conditionId(context))
      .setOwner(ComponentName(context, StudyFocusConditionProvider::class.java))
      .setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
      .setTriggerDescription("독서실에서 공부하는 동안")
      .setEnabled(true)
      .build()
    val id = notificationManager.addAutomaticZenRule(rule)
      ?: throw IllegalStateException("집중 규칙을 만들지 못했습니다")
    prefs(context).edit().putString(RULE_ID, id).apply()
    return id
  }

  fun setOwnRule(context: Context, enabled: Boolean, leaseExpiresAtMs: Long = 0L) {
    if (!supported()) throw IllegalStateException("Android 15 이상에서 지원합니다")
    if (!hasAccess(context)) throw SecurityException("방해금지 정책 접근 권한이 필요합니다")
    val notificationManager = manager(context)
    val alarmManager = context.getSystemService(AlarmManager::class.java)
    val alarm = expiryIntent(context)
    if (enabled) {
      if (leaseExpiresAtMs <= System.currentTimeMillis()) throw IllegalArgumentException("공부 세션이 만료되었습니다")
      notificationManager.setAutomaticZenRuleState(
        ownRuleId(context), Condition(conditionId(context), "공부 중", Condition.STATE_TRUE)
      )
      // Best-effort local fail-safe; Android may defer an inexact idle alarm.
      alarmManager.setAndAllowWhileIdle(
        AlarmManager.ELAPSED_REALTIME_WAKEUP,
        SystemClock.elapsedRealtime() + (leaseExpiresAtMs - System.currentTimeMillis()), alarm,
      )
    } else {
      alarmManager.cancel(alarm)
      prefs(context).getString(RULE_ID, null)?.let { id ->
        if (notificationManager.getAutomaticZenRule(id) != null) {
          notificationManager.setAutomaticZenRuleState(
            id, Condition(conditionId(context), "휴식 또는 종료", Condition.STATE_FALSE)
          )
        }
      }
    }
  }
}

class StudyFocusModeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("StudyFocusMode")

    Function("getStatus") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      mapOf(
        "supported" to StudyFocusRule.supported(),
        "hasAccess" to StudyFocusRule.hasAccess(context),
        "active" to StudyFocusRule.ownRuleActive(context),
      )
    }

    Function("openPolicySettings") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      context.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      )
    }

    Function("setOwnRule") { enabled: Boolean, leaseExpiresAtMs: Double ->
      val context = appContext.reactContext ?: throw IllegalStateException("Android context unavailable")
      StudyFocusRule.setOwnRule(context, enabled, leaseExpiresAtMs.toLong())
    }
  }
}
