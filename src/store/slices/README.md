# Slices métier

`authSlice` et `cartSlice` constituent le socle de démonstration.

Les données serveur destinées à être synchronisées avec Laravel doivent être ajoutées via RTK Query dans `src/services/api/` plutôt que dupliquées dans des slices classiques :

- catalogue ;
- commandes ;
- négociations ;
- chat ;
- tracking ;
- notifications.
