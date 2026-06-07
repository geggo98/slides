<script setup lang="ts">
import MonacoBlock from "@shared/components/MonacoBlock.vue";

const code = `plugins {
    java
    id("net.ltgt.errorprone") version "5.1.0"
    id("net.ltgt.nullaway")   version "3.0.0"
}

java {
    toolchain { languageVersion = JavaLanguageVersion.of(25) }
}

dependencies {
    implementation("org.jspecify:jspecify:1.0.0")
    errorprone("com.google.errorprone:error_prone_core:2.42.0")
    errorprone("com.uber.nullaway:nullaway:0.13.2")
}

tasks.withType<JavaCompile>().configureEach {
    options.errorprone {
        disableAllChecks = true
        option("NullAway:OnlyNullMarked", "true")  // nur @NullMarked Pakete
        option("NullAway:JSpecifyMode", "true")    // volle Generics
        error("NullAway")                          // Warning -> Error
    }
}`;
</script>

<template>
  <MonacoBlock :code="code" language="kotlin" height="380px" />
</template>
