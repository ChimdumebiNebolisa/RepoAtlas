package com.example.util;

public class StringUtils {
    public static String format(String template, String arg) {
        return template.replace("%s", arg);
    }
}
