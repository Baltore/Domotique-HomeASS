// Export OBJ (tous les niveaux) d'un .sh3d sans ouvrir Sweet Home 3D : appelle l'exporteur interne de l'application (celui de Vue 3D > Exporter au format OBJ).
// usage optionnel : ExportObj plan.sh3d sortie.obj [facteur id1,id2,...] -> réduit la hauteur des meubles listés (export seulement, le plan n'est pas modifié).
// usage : voir README.md (compiler avec le JDK, classpath = dossier lib de Sweet Home 3D copié + java3d-1.6)
import com.eteks.sweethome3d.model.*;
import com.eteks.sweethome3d.io.*;
import com.eteks.sweethome3d.viewcontroller.*;
import com.sm.sweethome3d.furnituremanager.base.UserCatalogImportedInterface;
import com.sm.sweethome3d.furnituremanager.base.UserCatalogImportedProvider;
import com.sm.sweethome3d.utils.base.LogUtilityInterface;
import com.sm.sweethome3d.utils.base.LogUtilityProvider;
import java.lang.reflect.Proxy;
import java.lang.reflect.Method;

public class ExportObj {
  public static void main(String[] a) throws Exception {
    ClassLoader cl = ExportObj.class.getClassLoader();
    // la version Microsoft Store attend des « fournisseurs » initialisés par l'application : on les remplace par des coquilles vides
    UserCatalogImportedProvider.setupInstance((UserCatalogImportedInterface) Proxy.newProxyInstance(cl, new Class[]{UserCatalogImportedInterface.class},
      (px, m, ar) -> { Class<?> r = m.getReturnType(); if (r == java.util.List.class) return new java.util.ArrayList<Object>(); if (r == java.util.Map.class) return new java.util.HashMap<Object, Object>(); return null; }));
    LogUtilityProvider.setUpInstance((LogUtilityInterface) Proxy.newProxyInstance(cl, new Class[]{LogUtilityInterface.class}, (px, m, ar) -> null));
    Home home = new HomeFileRecorder().readHome(a[0]);
    if (a.length >= 4) {
      float k = Float.parseFloat(a[2]);
      java.util.Set<String> ids = new java.util.HashSet<>(java.util.Arrays.asList(a[3].split(",")));
      for (HomePieceOfFurniture p : home.getFurniture()) if (ids.contains(p.getId())) { p.setHeight(p.getHeight() * k); System.out.println("hauteur x" + k + " : " + p.getName()); }
    }
    System.out.println("niveaux " + home.getLevels().size() + ", murs " + home.getWalls().size());
    Class<?> ex = Class.forName("com.eteks.sweethome3d.swing.HomePane$OBJExporter");
    Method m = ex.getDeclaredMethod("exportHomeToFile", Home.class, String.class, String.class, boolean.class, Object3DFactory.class);
    m.setAccessible(true);
    m.invoke(null, home, a[1], "export", true, new com.eteks.sweethome3d.j3d.Object3DBranchFactory());   // true = tous les niveaux
    System.out.println("exporté : " + a[1]);
    System.exit(0);
  }
}
