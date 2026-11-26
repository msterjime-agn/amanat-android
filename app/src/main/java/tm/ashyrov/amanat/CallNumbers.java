package tm.ashyrov.amanat;

/** Exact international/local TM equivalence; no unsafe last-digits matching. */
final class CallNumbers {
    static String key(String value){
        if(value==null)return "";
        String raw=value.trim();if(!raw.matches("[+0-9 ()-]+"))return "";
        String p=raw.replaceAll("[^0-9]","");if(p.startsWith("00"))p=p.substring(2);
        if(!raw.startsWith("+")&&!raw.startsWith("00")&&p.matches("86[0-9]{7}"))p=p.substring(1);
        if(!raw.startsWith("+")&&!raw.startsWith("00")&&p.matches("6[0-9]{7}"))p="993"+p;
        return p.matches("[0-9]{7,15}")?p:"";
    }
}
