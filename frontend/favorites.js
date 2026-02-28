function stripMongoId(doc) {
    if (!doc) {
        return doc;
    }
    const { _id, ...clean } = doc;
    return clean;
}

async function listUserFavorites({ favoritesCollection, propertiesCollection, userId }) {
    const favoriteRows = await favoritesCollection.find({ userId: userId }).toArray();
    const favoriteIds = favoriteRows.map((item) => item.propertyId);

    if (!favoriteIds.length) {
        return [];
    }

    const properties = await propertiesCollection.find({ id: { $in: favoriteIds } }).toArray();
    return properties.map(stripMongoId);
}

async function addUserFavorite({ favoritesCollection, propertiesCollection, userId, propertyId }) {
    const property = await propertiesCollection.findOne({ id: propertyId });
    if (!property) {
        return { error: "Invalid propertyId", statusCode: 400 };
    }

    await favoritesCollection.updateOne(
        { userId: userId, propertyId: propertyId },
        { $set: { userId: userId, propertyId: propertyId, createdAt: new Date().toISOString() } },
        { upsert: true }
    );

    return { propertyId };
}

async function removeUserFavorite({ favoritesCollection, userId, propertyId }) {
    await favoritesCollection.deleteOne({ userId: userId, propertyId: propertyId });
    return { propertyId };
}

module.exports = {
    listUserFavorites,
    addUserFavorite,
    removeUserFavorite
};
