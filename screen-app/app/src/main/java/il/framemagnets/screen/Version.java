package il.framemagnets.screen;

import android.content.Context;

/** the app's version name, read from the package (no BuildConfig needed) */
final class Version {
    static String name(Context c) {
        try { return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName; } catch (Exception e) { return "?"; }
    }
}
