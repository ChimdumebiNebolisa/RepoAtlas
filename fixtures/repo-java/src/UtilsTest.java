public class UtilsTest {
    public static void main(String[] args) {
        if (!Utils.greet("world").equals("Hello, world!")) {
            throw new AssertionError("test failed");
        }
    }
}
