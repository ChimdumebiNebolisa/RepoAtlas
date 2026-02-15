package com.example;

import com.example.service.UserService;

public class AppTest {
    public static void main(String[] args) {
        if (!UserService.greet("x").equals("Hello, x!")) {
            throw new AssertionError("test failed");
        }
    }
}
