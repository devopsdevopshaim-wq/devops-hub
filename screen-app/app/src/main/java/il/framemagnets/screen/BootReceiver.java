package il.framemagnets.screen;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/** When the TV or the stick is switched on, the screen opens by itself (on unless turned off from the page).
 *  Android TV and Fire TV allow this on most models; phones on Android 10+ block it. */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context ctx, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        SharedPreferences p = ctx.getSharedPreferences("screen", Context.MODE_PRIVATE);
        if (!p.getBoolean("autostart", true)) return;
        Intent i = new Intent(ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try { ctx.startActivity(i); } catch (Exception e) { /* the system did not allow it */ }
    }
}
