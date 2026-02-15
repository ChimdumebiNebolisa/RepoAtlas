package com.example.service;

import com.example.util.StringUtils;

public class UserService {
    public static String greet(String name) {
        return StringUtils.format("Hello, %s!", name);
    }
}
