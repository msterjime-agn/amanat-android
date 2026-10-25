package tm.ashyrov.amanat;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure extraction rules shared by the accessibility adapter and JVM tests. */
final class ImoScreenReader {
    static final class Entry {
        final String kind, text;
        Entry(String kind, String text) { this.kind=kind; this.text=text==null?"":text.trim(); }
    }
    static final class Message {
        final String text, time, day, warning, context;
        Message(String text, String time, String day, String warning, String context) {
            this.text=text; this.time=time; this.day=day; this.warning=warning; this.context=context;
        }
    }
    static boolean supported(String pkg) {
        return "com.imo.android.imoimhd".equals(pkg) || "com.imo.android.imoim".equals(pkg);
    }
    static boolean candidate(String pkg, String title, String members) {
        // In the inspected IMO layout a group displays a comma-separated member list.
        // Status/last-seen labels of named private contacts are never accepted.
        return supported(pkg) && "Amanat".equalsIgnoreCase(title.trim())
                && members.contains(",") && members.length()<=500;
    }
    static boolean matches(String pkg, String title, String members, String boundPkg, String boundMembers) {
        return candidate(pkg,title,members) && pkg.equals(boundPkg)
                && !boundMembers.isEmpty() && members.equals(boundMembers);
    }
    static List<Message> extract(List<Entry> entries, LocalDate today) {
        List<Message> out=new ArrayList<>();
        String day="", warning="Дата сообщения не видна. Укажите день списка перед сохранением.";
        String pending=null, time="", context="";
        for (Entry e:entries) {
            if ("date".equals(e.kind)) {
                if(pending!=null) { out.add(new Message(pending,time,day,warning,context));pending=null;time=""; }
                context=e.text;String[] parsed=parseDay(e.text,today);day=parsed[0];warning=parsed[1];
            } else if ("message".equals(e.kind)) {
                if(pending!=null)out.add(new Message(pending,time,day,warning,context));
                pending=e.text;time="";
            } else if ("time".equals(e.kind) && pending!=null) time=e.text;
        }
        if(pending!=null)out.add(new Message(pending,time,day,warning,context));
        return out;
    }
    static String[] parseDay(String label, LocalDate today) {
        String s=label.toLowerCase(Locale.ROOT).trim();
        if(s.equals("сегодня")||s.equals("today"))return new String[]{today.toString(),""};
        if(s.equals("вчера")||s.equals("yesterday"))return new String[]{today.minusDays(1).toString(),""};
        try {
            LocalDate date;
            if(s.matches("\\d{4}-\\d{2}-\\d{2}"))date=LocalDate.parse(s);
            else if(s.matches("\\d{2}\\.\\d{2}\\.\\d{4}"))date=LocalDate.parse(s,DateTimeFormatter.ofPattern("dd.MM.uuuu").withResolverStyle(java.time.format.ResolverStyle.STRICT));
            else return new String[]{"","Дата в чате «"+label+"» неполная или не распознана. Укажите дату с годом."};
            if(date.isAfter(today))return new String[]{"","Дата сообщения находится в будущем. Проверьте дату."};
            return new String[]{date.toString(),""};
        } catch(Exception ignored) {return new String[]{"","Дата сообщения не распознана. Укажите день списка."};}
    }
}
