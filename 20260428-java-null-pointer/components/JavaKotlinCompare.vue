<script setup lang="ts">
import MonacoBlock from "./MonacoBlock.vue";

const javaCode = `@NullMarked
public class UserService {
    public Optional<User> findById(String id) { ... }

    public String greet(@Nullable User user) {
        if (user == null) return "Hi, anonymous";
        return "Hi, " + user.name();
    }
}`;

const kotlinCode = `class UserService {
    fun findById(id: String): User? = ...

    fun greet(user: User?): String =
        user?.let { "Hi, \${it.name}" }
            ?: "Hi, anonymous"
}`;
</script>

<template>
  <div class="grid grid-cols-2 gap-4">
    <div>
      <h3>Java mit JSpecify</h3>
      <MonacoBlock :code="javaCode" language="java" height="240px" />
    </div>
    <div>
      <h3>Kotlin</h3>
      <MonacoBlock :code="kotlinCode" language="kotlin" height="240px" />
    </div>
  </div>
</template>
