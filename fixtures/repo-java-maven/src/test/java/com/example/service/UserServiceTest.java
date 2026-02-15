package com.example.service;

public class UserServiceTest {
    public static void main(String[] args) {
        if (!UserService.greet("test").equals("Hello, test!")) {
            throw new AssertionError("test failed");
        }
    }
}
