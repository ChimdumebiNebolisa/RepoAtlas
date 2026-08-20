package com.acme.shared;

public class TextFormatter {
    public String join(String... values) {
        return String.join(" | ", values);
    }
}
