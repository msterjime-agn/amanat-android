package tm.ashyrov.amanat;

/** Runs against the production filter with a JDK, without an Android SDK or dependencies. */
public final class ImoGroupFilterTest {
    public static void main(String[] args) {
        int checked = 0;
        for (int sdk : new int[]{26, 27, 28, 35}) {
            check(true, "exact conversation", "Amanat", true, sdk); checked++;
            check(true, "case and ASCII padding", " \t aMaNaT\r\n", true, sdk); checked++;
            check(true, "Unicode padding", "\u00a0\u202fAmanat\u2007", true, sdk); checked++;
            check(true, "bidi wrapper", "\u200f\u2068Amanat\u2069\u200e", true, sdk); checked++;
            check(true, "CharSequence conversation", new StringBuilder("Amanat"), true, sdk); checked++;
            check(false, "other group regardless of sender", "Family", true, sdk); checked++;
            check(false, "group flag without chat identity", null, true, sdk); checked++;
            check(false, "private contact without conversation", null, false, sdk); checked++;
            check(false, "named private conversation", "Amanat", false, sdk); checked++;
            check(false, "missing group and chat evidence", null, null, sdk); checked++;
            check(false, "blank conversation is not chat evidence", "\u00a0\t", true, sdk); checked++;
            check(false, "malformed group flag", "Amanat", "true", sdk); checked++;
            check(false, "numeric group flag", "Amanat", 1, sdk); checked++;
            check(sdk < 28, "legacy conversation title", "Amanat", null, sdk); checked++;
            for (String other : new String[]{"Amanat VIP", "My Amanat", "Amanat2", "Amanat: Agmet",
                    "Agmet @ Amanat", "Amanat (2 messages)", "Аманат", "Аmanat", "Ama nat", "Ama\u200fnat"}) {
                check(false, "distinct conversation: " + other, other, true, sdk); checked++;
            }
        }
        System.out.println("IMO group filter: " + checked + " cases passed");
    }

    private static void check(boolean expected, String label, CharSequence conversation,
                              Object groupFlag, int sdk) {
        boolean actual = ImoGroupFilter.accepts(conversation, groupFlag, sdk);
        if (actual != expected) {
            throw new AssertionError(label + " (API " + sdk + "): expected " + expected + ", got " + actual);
        }
    }
}
