## Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# copy csproj and restore
COPY backend-dotnet/MalatyaAvize.Api/MalatyaAvize.Api.csproj MalatyaAvize.Api/
RUN dotnet restore MalatyaAvize.Api/MalatyaAvize.Api.csproj

# copy source and publish
COPY backend-dotnet/ ./
RUN dotnet publish MalatyaAvize.Api/MalatyaAvize.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

## Run
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8001
ENV ASPNETCORE_URLS=http://+:8001
ENTRYPOINT ["dotnet", "MalatyaAvize.Api.dll"]
