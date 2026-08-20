package com.acme.app;

import com.acme.orders.OrderService;
import com.acme.shared.*;

// import com.acme.fake.FakeService;
public class Application {
    private final BootConfig config = new BootConfig();
    private final OrderService orders = new OrderService();
    private final Clock clock = new Clock();
    private final TextFormatter formatter = new TextFormatter();
    private final String example = "GhostConfig and import com.acme.fake.FakeService;";

    public static void main(String[] args) {
        System.out.println(new Application().summary());
    }

    public String summary() {
        return formatter.join(config.environment(), orders.find("42"), clock.now());
    }
}
