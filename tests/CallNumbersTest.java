package tm.ashyrov.amanat;
public final class CallNumbersTest {
    public static void main(String[] args){
        for(String input:new String[]{"863075697","63075697","+99363075697","99363075697","0099363075697","+993 (63) 07-56-97"}){
            if(!"99363075697".equals(CallNumbers.key(input)))throw new AssertionError(input);
        }
        if(CallNumbers.key("+905551234567").equals(CallNumbers.key("863075697")))throw new AssertionError("foreign collision");
        if(!CallNumbers.key("*123#").isEmpty())throw new AssertionError("service number");
        System.out.println("native phone equivalence passed");
    }
}
