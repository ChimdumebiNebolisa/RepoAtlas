package com.acme.repository;

import com.acme.shared.*;

public class OrderRepository {
    private final Clock clock = new Clock();
    private final TextFormatter formatter = new TextFormatter();

    public String find(String id) {
        return formatter.join(id, clock.now());
    }
}
