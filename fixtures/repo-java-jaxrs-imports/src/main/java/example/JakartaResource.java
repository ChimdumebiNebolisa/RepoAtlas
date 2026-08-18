package example;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;

@Path("/jakarta")
public class JakartaResource {
  @GET
  public String show() {
    return "jakarta";
  }
}
