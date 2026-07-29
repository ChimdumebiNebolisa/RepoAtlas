export {
  pyprojectHasDependency,
  pytestIniDeclaresPytest,
  requirementsHasDependency,
} from "./dependencyEvidence/python";
export { pomDeclaresJUnit } from "./dependencyEvidence/maven";
export { gradleDeclaresJUnit } from "./dependencyEvidence/gradle";
