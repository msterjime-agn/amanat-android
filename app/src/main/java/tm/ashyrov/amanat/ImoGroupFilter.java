package tm.ashyrov.amanat;

/** Exact chat-name matching, kept independent of Android for JVM regression tests. */
final class ImoGroupFilter {
    private ImoGroupFilter() { }

    static boolean accepts(CharSequence conversationTitle, Object groupFlag, int sdkInt) {
        // EXTRA_TITLE can be a sender even in a group: it cannot identify the chat.
        if (!"Amanat".equalsIgnoreCase(trimHeader(conversationTitle))) return false;
        // API 26/27 MessagingStyle used a conversation title to denote a group.
        // On API 28+ named private conversations exist: require the group flag.
        if (groupFlag == null) return sdkInt < 28;
        return Boolean.TRUE.equals(groupFlag);
    }

    private static String trimHeader(CharSequence value) {
        if (value == null) return "";
        String text = value.toString();
        int start = 0, end = text.length();
        while (start < end && isPadding(text.charAt(start))) start++;
        while (end > start && isPadding(text.charAt(end - 1))) end--;
        return text.substring(start, end);
    }

    private static boolean isPadding(char c) {
        // Include NBSP/narrow NBSP and boundary bidi marks used in displayed titles.
        // Do not remove internal characters or guess sender/count suffixes.
        return Character.isWhitespace(c) || Character.isSpaceChar(c)
                || c == '\u061c' || c == '\u200e' || c == '\u200f'
                || (c >= '\u202a' && c <= '\u202e')
                || (c >= '\u2066' && c <= '\u2069');
    }
}
