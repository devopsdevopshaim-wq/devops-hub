package il.spider.car

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

/** A simple screen on the phone: what this app is and how to see it in the car. */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#0F0D24"))
            setPadding(48, 96, 48, 48)
            layoutDirection = View.LAYOUT_DIRECTION_RTL
        }
        fun text(t: String, size: Float, color: String, bold: Boolean = false) = TextView(this).apply {
            text = t; textSize = size; setTextColor(Color.parseColor(color)); gravity = Gravity.START
            if (bold) setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, 28)
        }
        box.addView(text("SPIDER רכב", 30f, "#F3D596", true))
        box.addView(text("האפליקציה הזו מופיעה ברשימת האפליקציות של Android Auto, בין אפליקציות המוזיקה.", 18f, "#FFFFFF"))
        box.addView(text("בתוכה: כל סגנונות הרדיו של האתר (תחנות רדיו ישראליות, תפילות, מוזיקה לפי סגנון) ותיקיית חדשות. בזמן שתחנה מנגנת, כותרות החדשות מתחלפות בשורת האמן.", 16f, "#E6E2FA"))
        box.addView(text("חבר את הטלפון לרכב, פתח את רשימת האפליקציות בלחיצה על הכפתור בפינה, ובחר SPIDER רכב.", 16f, "#E6E2FA"))
        box.addView(text("אם היא לא מופיעה: ב־Android Auto (בהגדרות הטלפון) לחץ 10 פעמים על שורת הגרסה, פתח הגדרות מפתח והפעל 'מקורות לא ידועים'. אחר כך נתק וחבר מחדש.", 15f, "#BDB8E6"))
        setContentView(box)
    }
}
