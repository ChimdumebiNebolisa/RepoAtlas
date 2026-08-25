# Human labels

`ImportedController.java` and `WildcardMappedController.java` are Spring web entrypoints because their annotations have direct Spring imports. `CustomController.java` defines a repository-local annotation with the same simple name and is not a Spring entrypoint.
