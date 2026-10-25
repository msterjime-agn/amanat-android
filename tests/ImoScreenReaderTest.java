package tm.ashyrov.amanat;
import java.time.LocalDate;
import java.util.List;
import java.util.ArrayList;
public final class ImoScreenReaderTest {
    static void check(boolean b,String message){if(!b)throw new AssertionError(message);}
    static ImoScreenReader.Entry e(String kind,String text){return new ImoScreenReader.Entry(kind,text);}
    public static void main(String[] args) throws Exception {
        String pkg="com.imo.android.imoimhd", members="Test Operator, Test Agent";
        check(ImoScreenReader.matches(pkg,"Amanat",members,pkg,members),"bound group");
        check(!ImoScreenReader.matches(pkg,"Other",members,pkg,members),"other chat");
        check(!ImoScreenReader.matches(pkg,"Amanat","last seen recently",pkg,members),"private namesake");
        check(!ImoScreenReader.matches(pkg,"Amanat","Changed, Members",pkg,members),"changed membership");
        check(!ImoScreenReader.matches("evil.app","Amanat",members,pkg,members),"wrong package");
        check(!ImoScreenReader.matches(pkg,"Amanat",members,pkg,""),"unbound");
        LocalDate today=LocalDate.of(2026,10,25);
        List<ImoScreenReader.Entry> rows=List.of(e("message","#1 Old 861111111 Mary 100 $"),e("time","12:46"),e("date","25 окт."),e("message","#1 New 862222222 Mary 200 $"),e("time","11:03"),e("message","#3 Third 863333333 Mary 300 $"),e("date","Сегодня"),e("message","#5 Fifth 864444444 Mary 500 $"));
        List<ImoScreenReader.Message> out=ImoScreenReader.extract(rows,today);
        check(out.size()==4,"all messages");check(out.get(0).day.isEmpty(),"never backfill date to preceding messages");
        check(out.get(1).day.isEmpty()&&!out.get(1).warning.isEmpty(),"yearless date requires review");
        check(out.get(1).time.equals("11:03"),"time paired with message");
        check(out.get(3).day.equals("2026-10-25")&&out.get(3).warning.isEmpty(),"explicit today");
        check(ImoScreenReader.parseDay("Вчера",today)[0].equals("2026-10-24"),"yesterday");
        check(ImoScreenReader.parseDay("24.10.2026",today)[0].equals("2026-10-24"),"full date");
        for(String label:List.of("31.02.2026","2026-10-26","25 Oct","unknown"))check(ImoScreenReader.parseDay(label,today)[0].isEmpty(),"uncertain/invalid date "+label);
        check(ImoScreenReader.extract(List.of(e("date","Сегодня")),today).isEmpty(),"no messages");
        // A synthetic tree with the same resource structure as the inspected device XML.
        javax.xml.parsers.DocumentBuilderFactory f=javax.xml.parsers.DocumentBuilderFactory.newInstance();
        f.setFeature("http://apache.org/xml/features/disallow-doctype-decl",true);
        org.w3c.dom.Document doc=f.newDocumentBuilder().parse(args[0]);
        List<ImoScreenReader.Entry> extracted=new ArrayList<>();
        org.w3c.dom.NodeList nodes=doc.getElementsByTagName("node");
        for(int i=0;i<nodes.getLength();i++) {
            org.w3c.dom.Element node=(org.w3c.dom.Element)nodes.item(i);
            String id=node.getAttribute("resource-id"),text=node.getAttribute("text");
            if(id.endsWith(":id/tv_timestamp_date"))extracted.add(e("date",text));
            else if(id.endsWith(":id/tv_message"))extracted.add(e("message",text));
            else if(id.endsWith(":id/imkit_date_inside"))extracted.add(e("time",text));
        }
        List<ImoScreenReader.Message> actual=ImoScreenReader.extract(extracted,today);
        check(actual.size()==6,"fixture six messages; deleted/system messages ignored");
        check(actual.stream().allMatch(m->m.day.isEmpty()&&!m.warning.isEmpty()),"fixture never invents year or dates");
        System.out.println("IMO screen reader: group binding, dates, message order and synthetic device-layout fixture passed");
    }
}
