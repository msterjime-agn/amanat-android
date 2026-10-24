package tm.ashyrov.amanat;

public final class ImoGroupFilterTest {
    private static int count;
    private static void check(boolean expected, String title, String conversation, boolean group) {
        count++;
        if (ImoGroupFilter.accepts(title, conversation, group) != expected)
            throw new AssertionError("Case " + count + " failed");
    }
    public static void main(String[] args) {
        check(true, "AGN 1015", "Amanat", true);
        check(true, "Amanat", null, true);
        check(true, " amanat ", "", true);
        check(true, "sender", "\u00a0AMANAT\u202f", true);
        check(false, "Amanat", "Other group", true);
        check(false, "Other group", "Other group", true);
        check(false, "Amanat", null, false);
        check(false, "sender", "Amanat", false);
        check(false, null, null, true);
        check(false, "AGN 1015: Amanat", null, true);
        check(false, "Amanat (2)", null, true);
        check(false, "Amanat archive", null, true);
        check(false, "sender", "Amanat\u200b", true);
        check(false, "Аmanat", null, true);
        System.out.println("Passed " + count + " IMO metadata filter cases");
    }
}
