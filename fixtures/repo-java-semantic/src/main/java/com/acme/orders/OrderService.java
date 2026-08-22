package com.acme.orders;

import com.acme.repository.OrderRepository;
import com.acme.shared.*;

public class OrderService {
    private final OrderRepository repository = new OrderRepository();
    private final OrderPolicy policy = new OrderPolicy();
    private final Clock clock = new Clock();
    private final TextFormatter formatter = new TextFormatter();
    private final String example = "OrderGhost";

    /* import com.acme.fake.FakeService; */
    public String find(String id) {
        if (!policy.allows(id)) {
            return formatter.join("rejected", clock.now());
        }
        return repository.find(id);
    }
}
