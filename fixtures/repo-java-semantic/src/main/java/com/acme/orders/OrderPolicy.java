package com.acme.orders;

public class OrderPolicy {
    public boolean allows(String id) {
        return !id.isBlank();
    }
}
