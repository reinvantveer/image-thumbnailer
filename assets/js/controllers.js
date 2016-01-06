'use strict';

var thumbnailControllers = angular.module("thumbnailControllers", []);

thumbnailControllers.controller('pictureDirController', ['$scope', function($scope) {
    $scope.getPictureDir = function (){
        angular.$http({
            method: 'GET',
            url: '/picturedir'
        }).then(function successCallback(response) {
            return response;
        }, function errorCallback(response) {
            console.error(response);
            // called asynchronously if an error occurs
            // or server returns response with an error status.
        });
    };

}]);
/*

thumbnailControllers.controller('thumbnailController', [$scope, function($scope) {
    console.log('thumbnailController');

     $scope.items = [];
     $scope.thumbnails = thumbs;
     $scope.counter = 0;
     $scope.folders = [];
     $scope.keyList = [];

     console.log(thumbs.length + ' thumbs');

     for (thumb in $scope.thumbnails) {
     if ($scope.folders.indexOf($scope.thumbnails[thumb].folder) === -1) {
     $scope.folders.push($scope.thumbnails[thumb].folder);
     }
     }

     $scope.folders.sort();

     $scope.thumbnails.forEach( function(element, index) {
     for (key in element) {
     if (element.hasOwnProperty(key)) {
     if ($scope.keyList.indexOf(key) === -1) {
     $scope.keyList.push(key);
     var selectUIelement = document.getElementById('selectDiv');
     var selectElementToAdd = document.createElement('select');
     selectElementToAdd.setAttribute('id', key + 'Select');
     selectElementToAdd.setAttribute('class', 'selectElement');
     selectElementToAdd.setAttribute('when-scrolled', 'selectMore("' + key + 'Select")');
     selectElementToAdd.innerHTML = '<option value="">' + 'Select by ' + key + '</option>';
     var idHash = hashCode('option' + key + element[key]);
     selectElementToAdd.innerHTML = selectElementToAdd.innerHTML + '<option id="' + idHash + '" value="' + element[key] + '">' + element[key] + '</option>';
     selectUIelement.appendChild(selectElementToAdd);
     } else {
     if (document.getElementById(hashCode('option' + key + element[key])) === null) {
     var selectElement = document.getElementById(key + 'Select');
     if (selectElement.length < 100) {
     var idHash = hashCode('option' + key + element[key]);
     selectElement.innerHTML = selectElement.innerHTML + '<option id="' + idHash + '" value="' + element[key] + '">' + element[key] + '</option>';
     console.log('<option id="' + idHash + '" value="' + element[key] + '">' + element[key] + '</option>');
     }
     }
     }
     }
     }
     });

     console.log($scope.folders.length + ' folders');

     $scope.loadMore = function(filterKey, filterValue) {
     if (filterKey && filterValue) {
     console.log(filterKey + ' ' + filterValue);
     for (var i in $scope.thumbnails) {
     if ($scope.thumbnails[$scope.counter].hasOwnProperty(filterKey)) {
     if ($scope.thumbnails[$scope.counter][filterKey] === filterValue) {
     $scope.items.push($scope.thumbnails[$scope.counter]);
     }
     }

     $scope.counter += 1;
     }

     } else {
     for (var i = 0; i < 100; i++) {
     $scope.items.push($scope.thumbnails[$scope.counter]);
     $scope.counter += 1;
     }
     }
     };

     $scope.setFilter = function(filterKey) {
     $scope.selectedFolder = document.getElementById("fldrSelect").value;
     console.log(document.getElementById("fldrSelect").value);
     $scope.items = [];
     $scope.counter = 0;
     $scope.loadMore(filterKey, document.getElementById("fldrSelect").value);
     }
}]);
*/
