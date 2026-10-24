package tm.ashyrov.amanat;

/** Conservative metadata gate. Unknown/private conversations are never imported. */
final class ImoGroupFilter {
    static boolean accepts(String title, String conversation, boolean isGroup) {
        if (!isGroup) return false;
        String group = clean(conversation);
        // Explicit conversation identity wins over a sender/display title.
        return "amanat".equals(group.isEmpty() ? clean(title) : group);
    }
    private static String clean(String value) {
        if (value == null) return "";
        // Strip outer Unicode spacing, but do not strip punctuation or invisible letters.
        int start = 0, end = value.length();
        while (start < end && space(value.charAt(start))) start++;
        while (end > start && space(value.charAt(end - 1))) end--;
        return value.substring(start, end).toLowerCase(java.util.Locale.ROOT);
    }
    private static boolean space(char c) { return Character.isWhitespace(c) || Character.isSpaceChar(c); }
}
