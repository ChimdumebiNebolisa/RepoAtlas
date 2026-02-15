package com.example.controller;

import com.example.service.UserService;

public class UserController {
    public String handle() {
        return UserService.greet("user");
    }
}
