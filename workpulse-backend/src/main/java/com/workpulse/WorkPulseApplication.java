package com.workpulse;

import com.workpulse.config.WorkPulseProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableConfigurationProperties(WorkPulseProperties.class)
@EnableScheduling
public class WorkPulseApplication {

    public static void main(String[] args) {
        SpringApplication.run(WorkPulseApplication.class, args);
    }
}
