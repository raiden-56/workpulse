package com.workpulse.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    public static final String BEARER = "bearerAuth";
    public static final String DEVICE = "deviceToken";

    @Bean
    public OpenAPI workPulseOpenApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("WorkPulse API")
                        .version("v1")
                        .description("Workforce intelligence, activity monitoring, attendance and analytics platform")
                        .license(new License().name("Proprietary")))
                .components(new Components()
                        .addSecuritySchemes(BEARER, new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT"))
                        .addSecuritySchemes(DEVICE, new SecurityScheme()
                                .type(SecurityScheme.Type.APIKEY).in(SecurityScheme.In.HEADER).name("X-Device-Token")))
                .addSecurityItem(new SecurityRequirement().addList(BEARER))
                .addSecurityItem(new SecurityRequirement().addList(DEVICE));
    }
}
